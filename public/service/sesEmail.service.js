import AWS from "aws-sdk";
import dotenv from "dotenv";
dotenv.config();

AWS.config.update({
  region: "ap-south-1",
  accessKeyId: process.env.AWS_SES_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SES_SECRET_KEY
});

const ses = new AWS.SES({ apiVersion: "2010-12-01" });

function maskEmail(email) {
  const [user, domain] = email.split("@");
  if (user.length <= 2) return `**@${domain}`;
  return `${user[0]}${"*".repeat(user.length - 2)}${user.slice(-1)}@${domain}`;
}

export async function sendOtpEmail(email, otp, expiresAt = null) {
  const maskedEmail = maskEmail(email);
  const expiryText = expiresAt
    ? `This OTP is valid until <b>${expiresAt}</b>.`
    : `This OTP is valid for <b>10 minutes</b>.`;

  const params = {
    Source: "Dwarkesh Motor Driving School <info@dwarkeshdrivingschool.com>",
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Subject: {
        Data: "Verify your email – OTP Code"
      },
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: `
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>

            <body style="margin:0; padding:0; background:#f4f6f8; font-family:Arial, sans-serif;">

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8; padding:20px;">
            <tr>
            <td align="center">

            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#ffffff; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.08); overflow:hidden;">

            <!-- HEADER -->
            <tr>
            <td style="background:#1a73e8; padding:16px 20px; text-align:center;">
            <h1 style="margin:0; font-size:20px; color:#ffffff;">
                Dwarkesh Motor Driving School
            </h1>
            </td>
            </tr>

            <!-- BODY -->
            <tr>
            <td style="padding:24px 24px 10px 24px; color:#333;">
            <p style="margin-top:0;">Hello,</p>

            <p>
                We received a request to verify the email address
                <b>${maskedEmail}</b> on
                <b>dwarkeshdrivingschool.com</b>.
            </p>

            <p style="margin-bottom:16px;">
                Please use the following One-Time Password (OTP) to continue:
            </p>

            <!-- OTP BOX -->
            <div style="text-align:center; margin:20px 0;">
                <span style="
                display:inline-block;
                background:#f1f5ff;
                border:1px dashed #1a73e8;
                padding:14px 26px;
                font-size:26px;
                letter-spacing:6px;
                font-weight:bold;
                color:#1a73e8;
                border-radius:8px;
                ">
                ${otp}
                </span>
            </div>

            <p style="font-size:14px; color:#555;">
                ${expiryText}
            </p>
            </td>
            </tr>

            <!-- FOOTER -->
            <tr>
            <td style="padding:16px 24px; font-size:12px; color:#777; border-top:1px solid #eee;">

            <p style="margin:0;">
                If you did not request this verification, please ignore this email.
            </p>

            <p style="margin:10px 0 0 0;">
                Need help? Contact us:
                <br>
                📧 <a href="mailto:info@dwarkeshdrivingschool.com"
                    style="color:#1a73e8; text-decoration:none;">
                    info@dwarkeshdrivingschool.com
                </a>
                &nbsp;|&nbsp;
                📞 +91 9924116122
            </p>

            <p style="margin:10px 0 0 0; color:#999;">
                © ${new Date().getFullYear()} Dwarkesh Motor Driving School
            </p>

            </td>
            </tr>

            </table>

            <!-- TRUST FOOTER -->
            <p style="margin-top:14px; font-size:12px; color:#999;">
            This email was sent securely from dwarkeshdrivingschool.com
            </p>

            </td>
            </tr>
            </table>

            </body>
            </html>
        `
        }
      }
    }
  };

  return ses.sendEmail(params).promise();
}
