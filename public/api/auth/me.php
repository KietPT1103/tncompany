<?php

declare(strict_types=1);

require __DIR__ . '/../_lib/bootstrap.php';
require_once __DIR__ . '/../_lib/auth.php';

$user = require_auth();

respond_ok([
    'user' => [
        'id' => $user['id'],
        'email' => $user['email'],
        'username' => $user['username'],
        'displayName' => $user['display_name'],
        'role' => $user['role'],
        'storeId' => $user['store_id'],
    ],
]);
