<?php

namespace App\Validators;

class ProfileValidator
{
    public static function validateUpdate(array $data): array
    {
        $errors = [];

        if (isset($data['bio']) && strlen($data['bio']) > 500) {
            $errors[] = 'Bio must not exceed 500 characters';
        }

        if (isset($data['username'])) {
            $name = trim($data['username']);
            if ($name === '') {
                $errors[] = 'Tên không được để trống';
            } elseif (mb_strlen($name) > 50) {
                $errors[] = 'Tên tối đa 50 ký tự';
            }
        }

        return $errors;
    }
}
