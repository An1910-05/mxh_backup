<?php

require_once __DIR__ . '/../vendor/autoload.php';

use App\Config\PdoOptions;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

$host = $_ENV['DB_HOST'];
$port = $_ENV['DB_PORT'];
$user = $_ENV['DB_USER'];
$pass = $_ENV['DB_PASS'];
$dbName = $_ENV['DB_NAME'];

try {
    $pdo = new PDO(
        "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4",
        $user,
        $pass,
        PdoOptions::mysqlOptions()
    );

    $pdo->exec("DELETE FROM friendships");
    $pdo->exec("DELETE FROM follows");
    $pdo->exec("DELETE FROM likes");
    $pdo->exec("DELETE FROM comments");
    $pdo->exec("DELETE FROM posts");
    $pdo->exec("DELETE FROM profiles");
    $pdo->exec("DELETE FROM users");
    $pdo->exec("DELETE FROM stories");
    $pdo->exec("DELETE FROM notifications");
    $pdo->exec("ALTER TABLE users AUTO_INCREMENT = 1");
    $pdo->exec("ALTER TABLE profiles AUTO_INCREMENT = 1");
    $pdo->exec("ALTER TABLE posts AUTO_INCREMENT = 1");
    $pdo->exec("ALTER TABLE comments AUTO_INCREMENT = 1");
    $pdo->exec("ALTER TABLE likes AUTO_INCREMENT = 1");
    $pdo->exec("ALTER TABLE follows AUTO_INCREMENT = 1");
    $pdo->exec("ALTER TABLE friendships AUTO_INCREMENT = 1");
    $pdo->exec("ALTER TABLE stories AUTO_INCREMENT = 1");
    $pdo->exec("ALTER TABLE notifications AUTO_INCREMENT = 1");

    $passwordHash = password_hash('password123', PASSWORD_BCRYPT);

    $users = [
        ['alice', 'alice@example.com', 'alice.wonder'],
        ['bob', 'bob@example.com', 'bobdev'],
        ['charlie', 'charlie@example.com', 'charlie.music'],
        ['diana', 'diana@example.com', 'diana.design'],
        ['eve', 'eve@example.com', 'evesec'],
    ];

    $stmt = $pdo->prepare("INSERT INTO users (username, email, custom_url, password_hash) VALUES (?, ?, ?, ?)");
    foreach ($users as $u) {
        $stmt->execute([$u[0], $u[1], $u[2], $passwordHash]);
    }
    echo "Seeded 5 users (password: password123)\n";

    $bios = [
        [1, 'Hi, I am Alice! Love coding and coffee.'],
        [2, 'Bob here. Full-stack developer.'],
        [3, 'Charlie - music and tech enthusiast.'],
        [4, 'Diana, designer and cat lover.'],
        [5, 'Eve, security researcher.'],
    ];

    $stmt = $pdo->prepare("INSERT INTO profiles (user_id, bio, avatar) VALUES (?, ?, NULL)");
    foreach ($bios as $b) {
        $stmt->execute([$b[0], $b[1]]);
    }
    echo "Seeded 5 profiles\n";

    $posts = [
        [1, 'Hello world! This is my first post on MXH.'],
        [1, 'Just finished building a new feature. Feels great!'],
        [2, 'Anyone else love PHP 8? The new features are amazing.'],
        [2, 'GraphQL is the future of APIs. Change my mind.'],
        [3, 'Listening to some great music while coding today.'],
        [3, 'Hot take: tabs are better than spaces.'],
        [4, 'Just designed a new UI mockup. Excited to share!'],
        [5, 'Found an interesting security vulnerability today. Stay safe online!'],
        [5, 'Reading about zero-knowledge proofs. Fascinating stuff.'],
        [4, 'Coffee + design = perfect morning.'],
    ];

    $stmt = $pdo->prepare("INSERT INTO posts (user_id, content) VALUES (?, ?)");
    foreach ($posts as $p) {
        $stmt->execute([$p[0], $p[1]]);
    }
    echo "Seeded 10 posts\n";

    $comments = [
        [1, 2, 'Welcome to MXH, Alice!'],
        [1, 3, 'Great to see you here!'],
        [3, 1, 'Totally agree! PHP 8 is awesome.'],
        [4, 1, 'I prefer REST but GraphQL has its merits.'],
        [5, 4, 'What genre are you listening to?'],
        [6, 2, 'Spaces forever!'],
        [7, 5, 'Would love to see the mockup!'],
        [8, 1, 'Thanks for the heads up!'],
    ];

    $stmt = $pdo->prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)");
    foreach ($comments as $c) {
        $stmt->execute([$c[0], $c[1], $c[2]]);
    }
    echo "Seeded 8 comments\n";

    $likes = [
        [1, 2], [1, 3], [1, 4],
        [2, 3], [2, 5],
        [3, 1], [3, 4], [3, 5],
        [4, 1], [4, 3],
        [5, 1], [5, 2],
        [7, 1], [7, 2], [7, 3],
        [8, 1], [8, 4],
    ];

    $stmt = $pdo->prepare("INSERT INTO likes (post_id, user_id) VALUES (?, ?)");
    foreach ($likes as $l) {
        $stmt->execute([$l[0], $l[1]]);
    }
    echo "Seeded 17 likes\n";

    $follows = [
        [1, 2], [1, 3],
        [2, 1], [2, 3], [2, 4],
        [3, 1], [3, 5],
        [4, 1], [4, 2], [4, 5],
        [5, 3], [5, 4],
    ];

    $stmt = $pdo->prepare("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)");
    foreach ($follows as $f) {
        $stmt->execute([$f[0], $f[1]]);
    }
    echo "Seeded 12 follows\n";

    // Friendships
    $friendships = [
        [1, 2, 'accepted'],  // alice & bob are friends
        [1, 4, 'accepted'],  // alice & diana are friends
        [3, 1, 'pending'],   // charlie sent request to alice (pending)
        [5, 2, 'pending'],   // eve sent request to bob (pending)
        [3, 4, 'accepted'],  // charlie & diana are friends
    ];

    $stmt = $pdo->prepare("INSERT INTO friendships (sender_id, receiver_id, status) VALUES (?, ?, ?)");
    foreach ($friendships as $f) {
        $stmt->execute([$f[0], $f[1], $f[2]]);
    }
    echo "Seeded 5 friendships\n";

    // Stories (seed with a few sample stories using placeholder media)
    $stories = [
        [1, '/uploads/stories/alice_1.jpg', 'image', 800, 600],
        [2, '/uploads/stories/bob_1.jpg', 'image', 800, 600],
        [3, '/uploads/stories/charlie_1.jpg', 'image', 800, 600],
    ];
    $stmt = $pdo->prepare("INSERT INTO stories (user_id, media_url, media_type, media_width, media_height, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))");
    foreach ($stories as $s) {
        $stmt->execute([$s[0], $s[1], $s[2], $s[3], $s[4]]);
    }
    echo "Seeded 3 stories\n";

    // Notifications
    $notifications = [
        [1, 'comment', 2, 1, null],   // bob commented on alice's post 1
        [1, 'comment', 3, 1, null],   // charlie commented on alice's post 1
        [2, 'mention_post', 3, 3, null], // charlie mentioned bob in post 3
        [4, 'comment', 5, 7, null],   // eve commented on diana's post 7
    ];
    $stmt = $pdo->prepare("INSERT INTO notifications (user_id, type, actor_id, post_id, comment_id) VALUES (?, ?, ?, ?, ?)");
    foreach ($notifications as $n) {
        $stmt->execute([$n[0], $n[1], $n[2], $n[3], $n[4]]);
    }
    echo "Seeded 4 notifications\n";

    echo "\nSeed completed successfully!\n";
    echo "You can login with any user (alice, bob, charlie, diana, eve) with password: password123\n";
    echo "Custom URLs: alice.wonder, bobdev, charlie.music, diana.design, evesec\n";
} catch (PDOException $e) {
    echo "Seed failed: " . $e->getMessage() . "\n";
    exit(1);
}
