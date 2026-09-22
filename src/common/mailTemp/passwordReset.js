
const PasswordReset = (email, link,FRONTEND_URL) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password - Brush & Colours</title>

      <style>
        body {
          background-color: #fffaf5;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 16px;
          line-height: 1.5;
          color: #333333;
          margin: 0;
          padding: 0;
        }

        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 30px 20px;
          text-align: center;
        }

        .card {
          background-color: #ffffff;
          border-radius: 12px;
          padding: 35px 25px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
        }

        .logo {
          max-width: 180px;
          margin-bottom: 20px;
        }

        .title {
          font-size: 28px;
          color: #222222;
          margin-bottom: 10px;
        }

        .subtitle {
          font-size: 17px;
          color: #666666;
          margin-bottom: 25px;
        }

        .user {
          font-size: 18px;
          color: #333333;
          margin-bottom: 15px;
        }

        .info {
          font-size: 16px;
          color: #555555;
          margin-bottom: 20px;
        }

        .reset-button {
          display: inline-block;
          background-color: #ff6b35;
          padding: 13px 28px;
          color: #ffffff;
          text-decoration: none;
          font-size: 16px;
          font-weight: bold;
          border-radius: 7px;
          margin: 10px 0 20px;
        }

        .reset-button:hover {
          background-color: #e85a28;
        }

        .security {
          background-color: #fff4ed;
          border-radius: 8px;
          padding: 15px;
          margin-top: 20px;
          font-size: 14px;
          color: #666666;
        }

        .support {
          font-size: 13px;
          color: #999999;
          margin-top: 25px;
        }

        .footer {
          font-size: 12px;
          color: #aaaaaa;
          margin-top: 25px;
        }

        .brand {
          color: #ff6b35;
          font-weight: bold;
        }
      </style>
    </head>

    <body>
      <div class="container">

        <div class="card">

          <a href="${FRONTEND_URL}">
            <img
              class="logo"
              src="${FRONTEND_URL}/logo.png"
              alt="Brush & Colours"
            >
          </a>

          <h1 class="title">Reset Your Password</h1>

          <p class="subtitle">
            Let's get you back to planning your perfect event!
          </p>

          <p class="user">
            Hello <strong>${email}</strong>,
          </p>

          <p class="info">
            We received a request to reset the password for your
            <span class="brand">Brush & Colours</span> account.
          </p>

          <p class="info">
            Click the button below to create a new password:
          </p>

          <p>
            <a
              href="${link}"
              class="reset-button"
              target="_blank"
              rel="noopener noreferrer"
            >
              Reset Password
            </a>
          </p>

          <div class="security">
            🔒 <strong>Didn't request this?</strong><br>
            No worries! Your account is still secure.
            Simply ignore this email and your password will remain unchanged.
          </div>

          <p class="support">
            If you have any questions or need help, please contact
            the Brush & Colours support team.
          </p>

          <div class="footer">
            © ${new Date().getFullYear()} Brush & Colours. All rights reserved.
            <br>
            Making your celebrations more colourful 🎨
          </div>

        </div>

      </div>
    </body>
    </html>
  `;
};

export {PasswordReset};
