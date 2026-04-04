<?php

namespace App\Validators;

class AuthValidator
{
    public static function validateRegister(array $data): array
    {
        $errors = [];

        if (empty($data['username'])) {
            $errors[] = 'Username is required';
        } elseif (strlen($data['username']) < 3 || strlen($data['username']) > 50) {
            $errors[] = 'Username must be between 3 and 50 characters';
        } elseif (!preg_match('/^[a-zA-Z0-9_]+$/', $data['username'])) {
            $errors[] = 'Username can only contain letters, numbers, and underscores';
        }

        if (empty($data['email'])) {
            $errors[] = 'Email is required';
        } elseif (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Invalid email format';
        }

        if (empty($data['password'])) {
            $errors[] = 'Password is required';
        } elseif (strlen($data['password']) < 6) {
            $errors[] = 'Password must be at least 6 characters';
        }

        if (!empty($data['birthday'])) {
            $d = \DateTime::createFromFormat('Y-m-d', $data['birthday']);
            if (!$d || $d->format('Y-m-d') !== $data['birthday']) {
                $errors[] = 'Ngày sinh không hợp lệ (YYYY-MM-DD)';
            } elseif ($d > new \DateTime()) {
                $errors[] = 'Ngày sinh không thể ở tương lai';
            }
        }

        if (!empty($data['gender'])) {
            if (!in_array($data['gender'], ['male', 'female', 'other'], true)) {
                $errors[] = 'Giới tính không hợp lệ';
            }
        }

        return $errors;
    }

    public static function validateLogin(array $data): array
    {
        $errors = [];

        if (empty($data['email'])) {
            $errors[] = 'Email is required';
        }

        if (empty($data['password'])) {
            $errors[] = 'Password is required';
        }

        return $errors;
    }
}
