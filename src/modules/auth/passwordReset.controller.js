import randomstring from "randomstring";
import bcrypt from 'bcryptjs' 

import passwordTokenModel from "./password_token.model.js";
import { User } from "./user.model.js";

import { PasswordReset } from "../../common/mailTemp/passwordReset.js";
import { sendMail } from "../../config/nodemail.js";

const resetPasswordToken = async (req, res) => {
  try {
    const { email } = req.body;
    // console.log(email);
    if (!email) {
      return res.status(401).json({
        success: false,
        message: "Please Enter Email",
      });
    }
    //existing user check
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json({
            success: false,
            message: "User Not Found,Please register",
        });
    }
    // console.log(user);
    //token create
    const randomToken = randomstring.generate(24);
    console.log("token",randomToken);
    const saveToken = await passwordTokenModel.findOneAndUpdate(
      { userId: user._id },
      { token: randomToken },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    );
    // const resetLink = `${process.env.FRONTEND_URL}/forgotpassword?token=${randomToken}`;
    const resetLink = `${process.env.FRONTEND_URL}/forgotpassword/${randomToken}`;
    //send email
    try {
        const emailBody = PasswordReset(email, resetLink,process.env.FRONTEND_URL);
     const mail = await sendMail({
  to:email, 
  subject: "Password Reset Link-Brush and Colours", 
  html:emailBody
});

        return res.status(201).json({
        message: "Reset Link sent",
        mail,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Unable to send the Link on email",
        log: error.message,
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Unable to send the Reset Link",
      error: err.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;
    const findToken = await passwordTokenModel.findOne({ token });

    if (!findToken) {
      return res.status(404).json({
        success: false,
        message: "Invalid Token",
      });
    }

    const userID = findToken.userId.toString();

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
  
    const updateUser = await User.findByIdAndUpdate(
      userID,
      {
        passwordHash: hashedPassword,
      },
      { new: true },
    );

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Unable to reset the password",
      error: err.message,
    });
  }
};

export { resetPasswordToken, resetPassword };
