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

        return $errors;
    }
}
