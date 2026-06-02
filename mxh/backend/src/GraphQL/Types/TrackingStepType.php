<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use GraphQL\Type\Definition\ObjectType;

class TrackingStepType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'TrackingStep',
            'fields' => [
                'time'   => Type::string(), // thời điểm (ISO string từ carrier)
                'status' => Type::string(), // mã trạng thái gốc của carrier
                'label'  => Type::string(), // nhãn tiếng Việt
            ],
        ]);
    }
}
