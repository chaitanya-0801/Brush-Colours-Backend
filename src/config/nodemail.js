import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});

export const sendMail = async ({ to, subject, html }) => {
  try {
    console.log("Sending email:", {
      to,
      subject,
      mailUser: process.env.MAIL_USER,
      passwordExists: !!process.env.MAIL_PASSWORD,
    });

    const info = await transporter.sendMail({
      from: `"Brush & Colours" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("Email sent:", info.messageId);

    return info;
  } catch (error) {
    console.error("Email sending failed:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });

    throw error;
  }
};