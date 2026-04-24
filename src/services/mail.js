import { Resend } from "resend";
import "dotenv/config";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (from_company, to, subject, html ) => {
  try {
    const data = await resend.emails.send({
      from: `${from_company} <noreply@${process.env.EMAIL_DOMAIN}>`,
      to: [to],
      subject: subject,
      html: html
    });
    return data;
  } catch (error) {
    throw error;
  }
};