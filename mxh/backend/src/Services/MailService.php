<?php

namespace App\Services;

use PHPMailer\PHPMailer\Exception as PHPMailerException;
use PHPMailer\PHPMailer\PHPMailer;

class MailService
{
    private string $host;
    private int $port;
    private string $username;
    private string $password;
    private string $encryption;
    private string $fromAddress;
    private string $fromName;

    public function __construct()
    {
        $this->host = trim($_ENV['MAIL_HOST'] ?? '');
        $this->port = (int) ($_ENV['MAIL_PORT'] ?? 587);
        $this->username = trim($_ENV['MAIL_USERNAME'] ?? '');
        $this->password = str_replace(' ', '', trim($_ENV['MAIL_PASSWORD'] ?? ''));
        $this->encryption = strtolower(trim($_ENV['MAIL_ENCRYPTION'] ?? 'tls'));
        $this->fromAddress = trim($_ENV['MAIL_FROM_ADDRESS'] ?? $this->username);
        $this->fromName = trim($_ENV['MAIL_FROM_NAME'] ?? 'iPock');
    }

    public function isConfigured(): bool
    {
        return $this->host !== ''
            && $this->port > 0
            && $this->username !== ''
            && $this->password !== ''
            && $this->fromAddress !== '';
    }

    public function sendPasswordResetEmail(string $toEmail, ?string $toName, string $resetLink): void
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('Mail service is not configured', 500);
        }

        $mail = new PHPMailer(true);

        try {
            $mail->isSMTP();
            $mail->Host = $this->host;
            $mail->Port = $this->port;
            $mail->SMTPAuth = true;
            $mail->Username = $this->username;
            $mail->Password = $this->password;
            $mail->CharSet = 'UTF-8';

            if ($this->encryption === 'ssl') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            } elseif ($this->encryption === 'tls') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            }

            $mail->setFrom($this->fromAddress, $this->fromName);
            $mail->addAddress($toEmail, $toName ?: '');

            $mail->isHTML(true);
            $mail->Subject = 'Dat lai mat khau iPock';
            $mail->Body = $this->buildResetPasswordHtml($toName, $resetLink);
            $mail->AltBody = $this->buildResetPasswordText($resetLink);

            $mail->send();
        } catch (PHPMailerException $e) {
            throw new \RuntimeException('Khong gui duoc email dat lai mat khau: ' . $e->getMessage(), 500);
        }
    }

    private function buildResetPasswordHtml(?string $toName, string $resetLink): string
    {
        $safeLink = htmlspecialchars($resetLink, ENT_QUOTES, 'UTF-8');
        $displayName = htmlspecialchars($toName ?: 'ban', ENT_QUOTES, 'UTF-8');

        return <<<HTML
<!doctype html>
<html lang="vi">
  <body style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:32px;">
      <div style="font-size:24px;font-weight:700;margin-bottom:12px;">Dat lai mat khau</div>
      <p style="margin:0 0 16px;line-height:1.6;">Xin chao {$displayName},</p>
      <p style="margin:0 0 16px;line-height:1.6;">
        Chung toi nhan duoc yeu cau dat lai mat khau cho tai khoan iPock cua ban.
        Bam vao nut ben duoi de tao mat khau moi.
      </p>
      <p style="margin:24px 0;">
        <a href="{$safeLink}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#1877f2;color:#ffffff;text-decoration:none;font-weight:700;">
          Dat lai mat khau
        </a>
      </p>
      <p style="margin:0 0 12px;line-height:1.6;">Neu nut khong hoat dong, hay mo link nay:</p>
      <p style="margin:0 0 16px;word-break:break-all;">
        <a href="{$safeLink}" style="color:#1877f2;">{$safeLink}</a>
      </p>
      <p style="margin:0;line-height:1.6;color:#475569;">
        Link nay se het han sau 1 gio. Neu ban khong yeu cau dat lai mat khau, ban co the bo qua email nay.
      </p>
    </div>
  </body>
</html>
HTML;
    }

    private function buildResetPasswordText(string $resetLink): string
    {
        return "Ban da yeu cau dat lai mat khau iPock.\n\n"
            . "Mo link sau de tao mat khau moi:\n{$resetLink}\n\n"
            . "Link nay se het han sau 1 gio. Neu ban khong thuc hien yeu cau nay, hay bo qua email.";
    }
}
