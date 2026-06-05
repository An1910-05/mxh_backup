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
            $mail->Subject = '=?UTF-8?B?' . base64_encode('Đặt lại mật khẩu iPock') . '?=';
            $mail->Body = $this->buildResetPasswordHtml($toName, $resetLink);
            $mail->AltBody = $this->buildResetPasswordText($resetLink);

            $mail->send();
        } catch (PHPMailerException $e) {
            throw new \RuntimeException('Khong gui duoc email dat lai mat khau: ' . $e->getMessage(), 500);
        }
    }

    private function buildResetPasswordHtml(?string $toName, string $resetLink): string
    {
        $safeLink    = htmlspecialchars($resetLink, ENT_QUOTES, 'UTF-8');
        $displayName = htmlspecialchars($toName ?: 'bạn', ENT_QUOTES, 'UTF-8');

        return <<<HTML
<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Đặt lại mật khẩu iPock</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Logo -->
        <div style="margin-bottom:28px;">
          <span style="font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#0f172a;">iPock</span>
        </div>

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;box-shadow:0 4px 24px rgba(0,0,0,0.07);overflow:hidden;">

          <!-- Blue header bar -->
          <tr>
            <td style="background:linear-gradient(135deg,#0071e3 0%,#2d9cdb 100%);padding:28px 36px;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.75);">Bảo mật tài khoản</p>
              <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#ffffff;">Đặt lại mật khẩu</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
                Xin chào <strong>{$displayName}</strong>,
              </p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#475569;">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>iPock</strong> của bạn.
                Nhấn vào nút bên dưới để tạo mật khẩu mới.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:12px;background:#0071e3;">
                    <a href="{$safeLink}"
                       style="display:inline-block;padding:14px 32px;border-radius:12px;background:#0071e3;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:-0.1px;">
                      Đặt lại mật khẩu
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;" />

              <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.6;">
                Nếu nút không hoạt động, hãy sao chép và dán link sau vào trình duyệt:
              </p>
              <p style="margin:0 0 24px;word-break:break-all;">
                <a href="{$safeLink}" style="color:#0071e3;font-size:13px;text-decoration:underline;">{$safeLink}</a>
              </p>

              <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">
                Link này sẽ hết hạn sau <strong>1 giờ</strong>.
                Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — tài khoản của bạn vẫn an toàn.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 36px;border-radius:0 0 20px 20px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
                Email này được gửi tự động từ hệ thống <strong>iPock</strong>. Vui lòng không trả lời email này.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
    }

    private function buildResetPasswordText(string $resetLink): string
    {
        return "Bạn đã yêu cầu đặt lại mật khẩu iPock.\n\n"
            . "Mở link sau để tạo mật khẩu mới:\n{$resetLink}\n\n"
            . "Link này sẽ hết hạn sau 1 giờ. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.";
    }
}
