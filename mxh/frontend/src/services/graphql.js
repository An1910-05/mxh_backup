import { graphqlFetch } from './api';

const POST_FIELDS = `id user_id username user_avatar user_is_verified content media_url media_type media_width media_height location_label latitude longitude like_count comment_count is_liked top_reactions created_at`;
const COMMENT_FIELDS = `id post_id parent_id user_id username user_avatar content created_at media_url media_type media_width media_height`;


export async function getFeed(limit = 20, page = 1) {
  const data = await graphqlFetch(`query Feed(`+`$limit: Int, $page: Int) { feed(limit: $limit, page: $page) { ${POST_FIELDS} } }`, { limit, page });
  return data.feed;
}

export async function getPosts(limit = 20, page = 1) {
  const data = await graphqlFetch(`query Posts(`+`$limit: Int, $page: Int) { posts(limit: $limit, page: $page) { ${POST_FIELDS} } }`, { limit, page });
  return data.posts;
}

export async function getPost(id) {
  const data = await graphqlFetch(`query Post(`+`$id: Int!) { post(id: $id) { ${POST_FIELDS} } }`, { id: parseInt(id) });
  return data.post;
}

export async function getUserPosts(userId, limit = 20, page = 1) {
  const data = await graphqlFetch(`query UserPosts(`+`$userId: Int!, $limit: Int, $page: Int) { userPosts(userId: $userId, limit: $limit, page: $page) { ${POST_FIELDS} } }`, { userId: parseInt(userId), limit, page });
  return data.userPosts;
}

export async function getProfile(userId) {
  const data = await graphqlFetch(`query Profile(`+`$userId: Int!) { profile(userId: $userId) { user_id username email custom_url bio avatar cover_photo post_count follower_count following_count friend_count is_following friendship_status friendship_id friendship_is_sender is_verified verified_until last_login_device created_at } }`, { userId: parseInt(userId) });
  return data.profile;
}

export async function getProfileByCustomUrl(url) {
  const data = await graphqlFetch(`query ProfileByCustomUrl(`+`$url: String!) { profileByCustomUrl(url: $url) { user_id username email custom_url bio avatar cover_photo post_count follower_count following_count friend_count is_following friendship_status friendship_id friendship_is_sender is_verified verified_until last_login_device created_at } }`, { url });
  return data.profileByCustomUrl;
}

export async function getComments(postId) {
  const data = await graphqlFetch(`query Comments(`+`$postId: Int!) { comments(postId: $postId) { ${COMMENT_FIELDS} } }`, { postId: parseInt(postId) });
  return data.comments;
}

export async function createPost(payload = {}) {
  const { content='', mediaUrl=null, mediaType=null, mediaWidth=null, mediaHeight=null, locationLabel=null, latitude=null, longitude=null } = payload;
  const data = await graphqlFetch(`mutation CreatePost(`+`$content: String!, $media_url: String, $media_type: String, $media_width: Int, $media_height: Int, $location_label: String, $latitude: Float, $longitude: Float) { createPost(content: $content, media_url: $media_url, media_type: $media_type, media_width: $media_width, media_height: $media_height, location_label: $location_label, latitude: $latitude, longitude: $longitude) { ${POST_FIELDS} } }`, {
    content, media_url: mediaUrl, media_type: mediaType, media_width: mediaWidth, media_height: mediaHeight,
    location_label: locationLabel, latitude, longitude
  });
  return data.createPost;
}

export async function editPost(postId, content) {
  const data = await graphqlFetch(`mutation EditPost(`+`$postId: Int!, $content: String!) { editPost(postId: $postId, content: $content) { id content } }`, { postId: parseInt(postId), content });
  return data.editPost;
}

export async function deletePost(postId) {
  const data = await graphqlFetch(`mutation DeletePost(`+`$postId: Int!) { deletePost(postId: $postId) }`, { postId: parseInt(postId) });
  return data.deletePost;
}

export async function likePost(postId, reactionType = 'like') {
  const data = await graphqlFetch(
    `mutation LikePost(`+`$postId: Int!, $reactionType: String!) { likePost(postId: $postId, reactionType: $reactionType) }`,
    { postId: parseInt(postId), reactionType }
  );
  return data.likePost;
}

export async function getPostLikers(postId, limit = 50) {
  const data = await graphqlFetch(
    `query PostLikers(`+`$postId: Int!, $limit: Int) { postLikers(postId: $postId, limit: $limit) { id username user_avatar reaction_type } }`,
    { postId: parseInt(postId), limit }
  );
  return data.postLikers ?? [];
}

export async function unlikePost(postId) {
  const data = await graphqlFetch(`mutation UnlikePost(`+`$postId: Int!) { unlikePost(postId: $postId) }`, { postId: parseInt(postId) });
  return data.unlikePost;
}

export async function createComment(postId, content, media = {}, parentId = null) {
  const { mediaUrl=null, mediaType=null, mediaWidth=null, mediaHeight=null } = media;
  const data = await graphqlFetch(`mutation CreateComment(`+`$postId: Int!, $content: String!, $media_url: String, $media_type: String, $media_width: Int, $media_height: Int, $parent_id: Int) { createComment(postId: $postId, content: $content, media_url: $media_url, media_type: $media_type, media_width: $media_width, media_height: $media_height, parent_id: $parent_id) { ${COMMENT_FIELDS} } }`, {
    postId: parseInt(postId), content, media_url: mediaUrl, media_type: mediaType, media_width: mediaWidth, media_height: mediaHeight, parent_id: parentId ? parseInt(parentId) : null
  });
  return data.createComment;
}

export async function deleteComment(commentId) {
  const data = await graphqlFetch(`mutation DeleteComment(`+`$commentId: Int!) { deleteComment(commentId: $commentId) }`, { commentId: parseInt(commentId) });
  return data.deleteComment;
}

export async function updateProfile(bio) {
  const data = await graphqlFetch(`mutation UpdateProfile(`+`$bio: String) { updateProfile(bio: $bio) { user_id username bio avatar post_count follower_count following_count } }`, { bio });
  return data.updateProfile;
}

export async function clearAvatar() {
  const data = await graphqlFetch(`mutation ClearAvatar(`+`$avatar: String) { updateProfile(avatar: $avatar) { user_id username bio avatar cover_photo post_count follower_count following_count friend_count } }`, { avatar: null });
  return data.updateProfile;
}

export async function updateCustomUrl(url) {
  const data = await graphqlFetch(`mutation UpdateCustomUrl(`+`$url: String!) { updateCustomUrl(url: $url) }`, { url });
  return data.updateCustomUrl;
}

export async function followUser(userId) {
  const data = await graphqlFetch(`mutation FollowUser(`+`$userId: Int!) { followUser(userId: $userId) }`, { userId: parseInt(userId) });
  return data.followUser;
}

export async function unfollowUser(userId) {
  const data = await graphqlFetch(`mutation UnfollowUser(`+`$userId: Int!) { unfollowUser(userId: $userId) }`, { userId: parseInt(userId) });
  return data.unfollowUser;
}

export async function searchUsers(query, limit = 20) {
  const data = await graphqlFetch(`query SearchUsers(`+`$query: String!, $limit: Int) { searchUsers(query: $query, limit: $limit) { id username email custom_url avatar is_verified created_at } }`, { query, limit });
  return data.searchUsers;
}

export async function sendFriendRequest(userId) {
  const data = await graphqlFetch(`mutation SendFriendRequest(`+`$userId: Int!) { sendFriendRequest(userId: $userId) { message status friendship_id } }`, { userId: parseInt(userId) });
  return data.sendFriendRequest;
}

export async function acceptFriendRequest(friendshipId) {
  const data = await graphqlFetch(`mutation AcceptFriendRequest(`+`$friendshipId: Int!) { acceptFriendRequest(friendshipId: $friendshipId) }`, { friendshipId: parseInt(friendshipId) });
  return data.acceptFriendRequest;
}

export async function rejectFriendRequest(friendshipId) {
  const data = await graphqlFetch(`mutation RejectFriendRequest(`+`$friendshipId: Int!) { rejectFriendRequest(friendshipId: $friendshipId) }`, { friendshipId: parseInt(friendshipId) });
  return data.rejectFriendRequest;
}

export async function cancelFriendRequest(friendshipId) {
  const data = await graphqlFetch(`mutation CancelFriendRequest(`+`$friendshipId: Int!) { cancelFriendRequest(friendshipId: $friendshipId) }`, { friendshipId: parseInt(friendshipId) });
  return data.cancelFriendRequest;
}

export async function cancelFriendRequestByUser(userId) {
  const data = await graphqlFetch(`mutation CancelFriendRequestByUser(`+`$userId: Int!) { cancelFriendRequestByUser(userId: $userId) }`, { userId: parseInt(userId) });
  return data.cancelFriendRequestByUser;
}

export async function unfriend(userId) {
  const data = await graphqlFetch(`mutation Unfriend(`+`$userId: Int!) { unfriend(userId: $userId) }`, { userId: parseInt(userId) });
  return data.unfriend;
}

export async function getMyFriends() {
  const data = await graphqlFetch(`query { myFriends { id username email custom_url avatar is_verified created_at } }`);
  return data.myFriends;
}

export async function getPendingFriendRequests() {
  const data = await graphqlFetch(`query { pendingFriendRequests { friendship_id id username custom_url avatar request_date } }`);
  return data.pendingFriendRequests;
}

export async function getSentFriendRequests() {
  const data = await graphqlFetch(`query { sentFriendRequests { friendship_id id username custom_url avatar request_date } }`);
  return data.sentFriendRequests;
}

export async function getUserFriends(userId) {
  const data = await graphqlFetch(`query UserFriends(`+`$userId: Int!) { userFriends(userId: $userId) { id username custom_url avatar } }`, { userId: parseInt(userId) });
  return data.userFriends;
}

export async function getUserFollowers(userId) {
  const data = await graphqlFetch(`query UserFollowers(`+`$userId: Int!) { userFollowers(userId: $userId) { id username custom_url avatar } }`, { userId: parseInt(userId) });
  return data.userFollowers;
}

export async function getUserFollowing(userId) {
  const data = await graphqlFetch(`query UserFollowing(`+`$userId: Int!) { userFollowing(userId: $userId) { id username custom_url avatar } }`, { userId: parseInt(userId) });
  return data.userFollowing;
}

export async function getFeedStories() {
  const data = await graphqlFetch(`query { feedStories { user_id username user_avatar stories { id user_id username user_avatar media_url media_type media_width media_height created_at expires_at } } }`);
  return data.feedStories;
}

export async function getUserStories(userId) {
  const data = await graphqlFetch(`query UserStories(`+`$userId: Int!) { userStories(userId: $userId) { id user_id username user_avatar media_url media_type media_width media_height created_at expires_at } }`, { userId: parseInt(userId) });
  return data.userStories;
}

export async function createStory(mediaUrl, mediaType, mediaWidth=null, mediaHeight=null) {
  const data = await graphqlFetch(`mutation CreateStory(`+`$media_url: String!, $media_type: String!, $media_width: Int, $media_height: Int) { createStory(media_url: $media_url, media_type: $media_type, media_width: $media_width, media_height: $media_height) { id user_id username user_avatar media_url media_type media_width media_height created_at expires_at } }`, { media_url: mediaUrl, media_type: mediaType, media_width: mediaWidth, media_height: mediaHeight });
  return data.createStory;
}

export async function deleteStory(storyId) {
  const data = await graphqlFetch(`mutation DeleteStory(`+`$storyId: Int!) { deleteStory(storyId: $storyId) }`, { storyId: parseInt(storyId) });
  return data.deleteStory;
}

// === Tỉu Xài (server-round) ===

const CURRENT_ROUND_FIELDS = `id round_code md5_hash status phase phase_seconds_left seconds_left betting_deadline tai_total tai_count xiu_total xiu_count dice total result_key result_label my_bet_side my_bet_amount my_did_win jackpot_payout`;
const ROUND_FIELDS_TX = `id round_code md5_hash dice total result_key result_label jackpot_side jackpot_payout tai_pool_snapshot xiu_pool_snapshot created_at`;
const BET_FIELDS_TX   = `id round_id round_code bet_side bet_label bet_amount result_key result_label dice total did_win net_amount balance_after jackpot_hit jackpot_payout created_at`;

export async function getTaiXiuOverview() {
  const data = await graphqlFetch(`query { taiXiuOverview { balance jackpot_tai_pool jackpot_xiu_pool tai_result_rate xiu_result_rate recent_rounds { ${ROUND_FIELDS_TX} } my_recent_bets { ${BET_FIELDS_TX} } jackpot_history { ${ROUND_FIELDS_TX} } current_round { ${CURRENT_ROUND_FIELDS} } } }`);
  return data.taiXiuOverview;
}

export async function getTaiXiuCurrentRound() {
  const data = await graphqlFetch(`query { taiXiuCurrentRound { ${CURRENT_ROUND_FIELDS} } }`);
  return data.taiXiuCurrentRound;
}

export async function getTaiXiuBetHistory(limit = 20, page = 1) {
  const data = await graphqlFetch(
    `query TaiXiuBetHistory($limit: Int, $page: Int) { taiXiuBetHistory(limit: $limit, page: $page) { ${BET_FIELDS_TX} } }`,
    { limit: parseInt(limit), page: parseInt(page) }
  );
  return data.taiXiuBetHistory;
}

export async function getTaiXiuRoundHistory(limit = 20) {
  const data = await graphqlFetch(
    `query TaiXiuRoundHistory($limit: Int) { taiXiuRoundHistory(limit: $limit) { ${ROUND_FIELDS_TX} } }`,
    { limit: parseInt(limit) }
  );
  return data.taiXiuRoundHistory;
}

export async function getTaiXiuJackpotHistory(limit = 20) {
  const data = await graphqlFetch(
    `query TaiXiuJackpotHistory($limit: Int) { taiXiuJackpotHistory(limit: $limit) { ${ROUND_FIELDS_TX} } }`,
    { limit: parseInt(limit) }
  );
  return data.taiXiuJackpotHistory;
}

export async function taiXiuPlaceBet(side, amount) {
  const data = await graphqlFetch(
    `mutation TaiXiuPlaceBet($side: String!, $amount: Int!) { taiXiuPlaceBet(side: $side, amount: $amount) { balance current_round { ${CURRENT_ROUND_FIELDS} } } }`,
    { side, amount: parseInt(amount) }
  );
  return data.taiXiuPlaceBet;
}

// === Notifications ===

export async function getNotifications(limit=40, page=1) {
  const data = await graphqlFetch(`query Notifications(`+`$limit: Int, $page: Int) { notifications(limit: $limit, page: $page) { id type actor_id actor_username actor_avatar post_id comment_id read_at created_at } }`, { limit, page });
  return data.notifications;
}

export async function getNotificationUnreadCount() {
  const data = await graphqlFetch(`query { notificationUnreadCount }`);
  return data.notificationUnreadCount;
}

export async function markNotificationRead(notificationId) {
  const data = await graphqlFetch(`mutation MarkNotificationRead(`+`$notificationId: Int!) { markNotificationRead(notificationId: $notificationId) }`, { notificationId: parseInt(notificationId) });
  return data.markNotificationRead;
}

export async function markAllNotificationsRead() {
  const data = await graphqlFetch(`mutation { markAllNotificationsRead }`);
  return data.markAllNotificationsRead;
}

export async function deleteNotification(notificationId) {
  const data = await graphqlFetch(`mutation DeleteNotification($notificationId: Int!) { deleteNotification(notificationId: $notificationId) }`, { notificationId: parseInt(notificationId) });
  return data.deleteNotification;
}

export async function deleteAllNotifications() {
  const data = await graphqlFetch(`mutation { deleteAllNotifications }`);
  return data.deleteAllNotifications;
}

// === Caro (Cờ caro) ===

const CARO_ROOM_FIELDS = `
  id code name has_password visibility is_matchmaking status current_turn
  board_size win_length move_count
  moves { r c s }
  winner_symbol winner_user_id
  creator { id username custom_url avatar }
  opponent { id username custom_url avatar }
  viewer_symbol is_my_turn
  rematch_room_id rematch_room_code rematch_initiated_by_id
  created_at updated_at last_move_at
`;

export async function getCaroRoom(id) {
  const data = await graphqlFetch(
    `query CaroRoom($id: Int!) { caroRoom(id: $id) { ${CARO_ROOM_FIELDS} } }`,
    { id: parseInt(id) }
  );
  return data.caroRoom;
}

export async function getCaroRoomByCode(code) {
  const data = await graphqlFetch(
    `query CaroRoomByCode($code: String!) { caroRoomByCode(code: $code) { ${CARO_ROOM_FIELDS} } }`,
    { code }
  );
  return data.caroRoomByCode;
}

export async function getCaroPublicRooms(limit = 30) {
  const data = await graphqlFetch(
    `query CaroPublicRooms($limit: Int) { caroPublicRooms(limit: $limit) { ${CARO_ROOM_FIELDS} } }`,
    { limit }
  );
  return data.caroPublicRooms;
}

export async function getCaroMyActiveRooms(limit = 10) {
  const data = await graphqlFetch(
    `query CaroMyActive($limit: Int) { caroMyActiveRooms(limit: $limit) { ${CARO_ROOM_FIELDS} } }`,
    { limit }
  );
  return data.caroMyActiveRooms;
}

export async function getCaroMyHistory(limit = 10) {
  const data = await graphqlFetch(
    `query CaroMyHistory($limit: Int) { caroMyHistory(limit: $limit) { ${CARO_ROOM_FIELDS} } }`,
    { limit }
  );
  return data.caroMyHistory;
}

export async function caroCreateRoom({ name, visibility, password, boardSize, winLength } = {}) {
  const data = await graphqlFetch(
    `mutation CaroCreateRoom($name: String, $visibility: String, $password: String, $boardSize: Int, $winLength: Int) {
       caroCreateRoom(name: $name, visibility: $visibility, password: $password, boardSize: $boardSize, winLength: $winLength) { ${CARO_ROOM_FIELDS} }
     }`,
    { name, visibility, password, boardSize, winLength }
  );
  return data.caroCreateRoom;
}

export async function caroJoinByCode(code, password) {
  const data = await graphqlFetch(
    `mutation CaroJoinByCode($code: String!, $password: String) {
       caroJoinByCode(code: $code, password: $password) { ${CARO_ROOM_FIELDS} }
     }`,
    { code, password }
  );
  return data.caroJoinByCode;
}

export async function caroRandomMatch() {
  const data = await graphqlFetch(
    `mutation { caroRandomMatch { ${CARO_ROOM_FIELDS} } }`
  );
  return data.caroRandomMatch;
}

export async function caroMakeMove(roomId, row, col) {
  const data = await graphqlFetch(
    `mutation CaroMakeMove($roomId: Int!, $row: Int!, $col: Int!) {
       caroMakeMove(roomId: $roomId, row: $row, col: $col) { ${CARO_ROOM_FIELDS} }
     }`,
    { roomId: parseInt(roomId), row: parseInt(row), col: parseInt(col) }
  );
  return data.caroMakeMove;
}

export async function caroLeaveRoom(roomId) {
  const data = await graphqlFetch(
    `mutation CaroLeaveRoom($roomId: Int!) {
       caroLeaveRoom(roomId: $roomId) { ${CARO_ROOM_FIELDS} }
     }`,
    { roomId: parseInt(roomId) }
  );
  return data.caroLeaveRoom;
}

export async function caroRequestRematch(roomId) {
  const data = await graphqlFetch(
    `mutation CaroRequestRematch($roomId: Int!) {
       caroRequestRematch(roomId: $roomId) { ${CARO_ROOM_FIELDS} }
     }`,
    { roomId: parseInt(roomId) }
  );
  return data.caroRequestRematch;
}

export async function caroDeclineRematch(roomId) {
  const data = await graphqlFetch(
    `mutation CaroDeclineRematch($roomId: Int!) {
       caroDeclineRematch(roomId: $roomId) { ${CARO_ROOM_FIELDS} }
     }`,
    { roomId: parseInt(roomId) }
  );
  return data.caroDeclineRematch;
}

// === Tích xanh xác thực ===
const PROFILE_VERIFIED_FIELDS = `user_id username email custom_url bio avatar cover_photo post_count follower_count following_count friend_count is_following friendship_status friendship_id friendship_is_sender is_verified verified_until created_at`;

export async function purchaseVerified(duration = 'monthly') {
  const data = await graphqlFetch(
    `mutation PurchaseVerified($duration: String) { purchaseVerified(duration: $duration) { ${PROFILE_VERIFIED_FIELDS} } }`,
    { duration }
  );
  return data.purchaseVerified;
}

export async function cancelVerified() {
  const data = await graphqlFetch(`mutation { cancelVerified { ${PROFILE_VERIFIED_FIELDS} } }`);
  return data.cancelVerified;
}
