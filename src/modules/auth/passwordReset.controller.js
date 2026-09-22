import randomstring from "randomstring";
import bcrypt from 'bcryptjs' 

import passwordTokenModel from "./password_token.model.js";
import { User } from "./user.model.js";

import { PasswordReset } from "../../common/mailTemp/passwordReset.js";
import { sendMail } from "../../config/nodemail.js";

const resetPasswordToken = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please enter email",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found, please register",
      });
    }

    const randomToken = randomstring.generate(24);

    console.log("Reset token generated for:", email);

    await passwordTokenModel.findOneAndUpdate(
      { userId: user._id },
      { token: randomToken },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    const resetLink =
      `${process.env.FRONTEND_URL}/forgotpassword/${randomToken}`;

    console.log("Reset link:", resetLink);

    const emailBody = PasswordReset(
      email,
      resetLink,
      process.env.FRONTEND_URL
    );

    await sendMail({
      to: email,
      subject: "Password Reset Link - Brush and Colours",
      html: emailBody,
    });

    return res.status(200).json({
      success: true,
      message: "Reset link sent",
    });

  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to send the reset link",
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
