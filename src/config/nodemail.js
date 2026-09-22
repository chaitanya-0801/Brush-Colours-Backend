import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
    },
})

export const sendMail = async ({ to, subject, html }) => {
    try {
        console.log(to,subject)
        const info = await transporter.sendMail({
            from: `"Brush & Colours" <${process.env.MAIL_USER}>`,
            to,
            subject,
            html,
        })

        console.log('Email sent:', info.messageId)
        return info
    } catch (error) {
        console.error('Email sending failed:', error)
        throw error
    }
}