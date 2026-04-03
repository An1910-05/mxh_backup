<?php

namespace App\Controllers;

use App\Helpers\Response;

class LinkPreviewController
{
    public function getPreview(): void
    {
        $url = $_GET['url'] ?? '';

        if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
            Response::error('Invalid URL', 400);
        }

        $cacheKey = md5($url);
        $cacheDir = __DIR__ . '/../../storage/cache/og';
        $cacheFile = $cacheDir . '/' . $cacheKey . '.json';

        if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 3600) {
            $cached = json_decode(file_get_contents($cacheFile), true);
            if ($cached) {
                Response::success($cached);
            }
        }

        $ogData = $this->fetchOgData($url);

        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }
        file_put_contents($cacheFile, json_encode($ogData, JSON_UNESCAPED_UNICODE));

        Response::success($ogData);
    }

    private function fetchOgData(string $url): array
    {
        $result = [
            'url' => $url,
            'title' => '',
            'description' => '',
            'image' => '',
            'site_name' => '',
            'hostname' => parse_url($url, PHP_URL_HOST) ?: '',
        ];

        $ctx = stream_context_create([
            'http' => [
                'timeout' => 5,
                'follow_location' => true,
                'max_redirects' => 3,
                'header' => "User-Agent: facebookexternalhit/1.1\r\nAccept: text/html\r\n",
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);

        $html = @file_get_contents($url, false, $ctx);
        if ($html === false) {
            return $result;
        }

        $html = mb_convert_encoding($html, 'UTF-8', mb_detect_encoding($html, 'UTF-8, ISO-8859-1, ASCII', true) ?: 'UTF-8');
        $html = substr($html, 0, 100000);

        if (preg_match_all('/<meta\s[^>]*property=["\']og:([^"\']+)["\'][^>]*content=["\']([^"\']*)["\'][^>]*\/?>/i', $html, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $prop = strtolower($m[1]);
                $val = html_entity_decode($m[2], ENT_QUOTES, 'UTF-8');
                match ($prop) {
                    'title' => $result['title'] = $val,
                    'description' => $result['description'] = $val,
                    'image' => $result['image'] = $val,
                    'site_name' => $result['site_name'] = $val,
                    default => null,
                };
            }
        }

        if (preg_match_all('/<meta\s[^>]*content=["\']([^"\']*)["\'][^>]*property=["\']og:([^"\']+)["\'][^>]*\/?>/i', $html, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $prop = strtolower($m[2]);
                $val = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
                if (empty($result[$prop]) || $prop === 'image') {
                    match ($prop) {
                        'title' => $result['title'] = $val,
                        'description' => $result['description'] = $val,
                        'image' => $result['image'] = $result['image'] ?: $val,
                        'site_name' => $result['site_name'] = $val,
                        default => null,
                    };
                }
            }
        }

        if (empty($result['title'])) {
            if (preg_match('/<title[^>]*>([^<]+)<\/title>/i', $html, $m)) {
                $result['title'] = html_entity_decode(trim($m[1]), ENT_QUOTES, 'UTF-8');
            }
        }

        if (empty($result['description'])) {
            if (preg_match('/<meta\s[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\'][^>]*\/?>/i', $html, $m)) {
                $result['description'] = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
            }
        }

        if (empty($result['image'])) {
            if (preg_match('/<meta\s[^>]*content=["\']([^"\']*)["\'][^>]*name=["\']description["\'][^>]*\/?>/i', $html, $m)) {
                if (empty($result['description'])) {
                    $result['description'] = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
                }
            }
            if (preg_match('/<meta\s[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']*)["\'][^>]*\/?>/i', $html, $m)) {
                $result['image'] = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
            }
            if (empty($result['image']) && preg_match('/<meta\s[^>]*content=["\']([^"\']*)["\'][^>]*name=["\']twitter:image["\'][^>]*\/?>/i', $html, $m)) {
                $result['image'] = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
            }
        }

        return $result;
    }
}
