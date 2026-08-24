<?php
/**
 * Plugin Name: ハッシン連携（Hasshin Receiver）
 * Description: 日本共産党北多摩東部地区委員会 宣伝部の編集支援ツール「ハッシン」から承認済み記事を受け取り、下書きとして投稿するプラグインです。
 * Version: 1.0.0
 * Author: 北多摩東部地区委員会 宣伝部
 * License: GPL-2.0-or-later
 * Text Domain: hasshin-receiver
 */

if (!defined('ABSPATH')) {
    exit;
}

define('HASSHIN_RECEIVER_OPTION_KEY', 'hasshin_receiver_api_key');
define('HASSHIN_RECEIVER_META_ARTICLE_ID', '_hasshin_article_id');
define('HASSHIN_RECEIVER_OPTION_LOG', 'hasshin_receiver_last_received');

// =========================================================
// 有効化時にAPIキーを自動生成（既にあれば何もしない）
// =========================================================
function hasshin_receiver_activate() {
    if (!get_option(HASSHIN_RECEIVER_OPTION_KEY)) {
        update_option(HASSHIN_RECEIVER_OPTION_KEY, hasshin_receiver_generate_key());
    }
}
register_activation_hook(__FILE__, 'hasshin_receiver_activate');

function hasshin_receiver_generate_key() {
    return bin2hex(random_bytes(32));
}

// =========================================================
// 管理画面: 設定ページ（設定 > ハッシン連携）
// =========================================================
function hasshin_receiver_add_settings_page() {
    add_options_page(
        'ハッシン連携',
        'ハッシン連携',
        'manage_options',
        'hasshin-receiver',
        'hasshin_receiver_render_settings_page'
    );
}
add_action('admin_menu', 'hasshin_receiver_add_settings_page');

function hasshin_receiver_render_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    if (
        isset($_POST['hasshin_receiver_action']) &&
        $_POST['hasshin_receiver_action'] === 'regenerate' &&
        check_admin_referer('hasshin_receiver_regenerate')
    ) {
        update_option(HASSHIN_RECEIVER_OPTION_KEY, hasshin_receiver_generate_key());
        echo '<div class="notice notice-success"><p>APIキーを再生成しました。ハッシン側の接続設定も新しいキーに更新してください。</p></div>';
    }

    $api_key = get_option(HASSHIN_RECEIVER_OPTION_KEY);
    $endpoint = rest_url('hasshin/v1/articles');
    $last_received = get_option(HASSHIN_RECEIVER_OPTION_LOG);
    ?>
    <div class="wrap">
        <h1>ハッシン連携</h1>
        <p>ハッシン（編集支援ツール）から承認された記事を、このサイトの下書きとして受け取るための設定です。</p>

        <table class="form-table">
            <tr>
                <th scope="row">受信先URL（エンドポイント）</th>
                <td><code><?php echo esc_html($endpoint); ?></code></td>
            </tr>
            <tr>
                <th scope="row">APIキー</th>
                <td>
                    <input type="text" readonly value="<?php echo esc_attr($api_key); ?>" class="regular-text code" style="width: 32em;" onclick="this.select();" />
                    <p class="description">この2つの値を、ハッシン側の「サイト接続設定」に登録してください。</p>
                </td>
            </tr>
            <tr>
                <th scope="row">直近の受信</th>
                <td><?php echo $last_received ? esc_html($last_received) : 'まだ受信していません'; ?></td>
            </tr>
        </table>

        <form method="post">
            <?php wp_nonce_field('hasshin_receiver_regenerate'); ?>
            <input type="hidden" name="hasshin_receiver_action" value="regenerate" />
            <?php submit_button('APIキーを再生成する（漏洩時など）', 'delete'); ?>
        </form>
    </div>
    <?php
}

// =========================================================
// REST API エンドポイント
// =========================================================
function hasshin_receiver_register_routes() {
    register_rest_route('hasshin/v1', '/articles', [
        'methods' => 'POST',
        'callback' => 'hasshin_receiver_handle_article',
        'permission_callback' => 'hasshin_receiver_check_auth',
    ]);

    register_rest_route('hasshin/v1', '/articles/(?P<article_id>[a-zA-Z0-9\-]+)', [
        'methods' => 'DELETE',
        'callback' => 'hasshin_receiver_handle_delete_article',
        'permission_callback' => 'hasshin_receiver_check_auth',
    ]);
}
add_action('rest_api_init', 'hasshin_receiver_register_routes');

function hasshin_receiver_check_auth(WP_REST_Request $request) {
    $stored_key = get_option(HASSHIN_RECEIVER_OPTION_KEY);
    $provided_key = $request->get_header('x-hasshin-api-key');

    if (!$stored_key || !$provided_key || !hash_equals($stored_key, $provided_key)) {
        return new WP_Error('hasshin_unauthorized', 'APIキーが正しくありません。', ['status' => 401]);
    }

    return true;
}

function hasshin_receiver_body_to_html($body_text) {
    $paragraphs = preg_split('/\n\s*\n/', trim((string) $body_text));
    $html_paragraphs = array_map(function ($p) {
        $escaped = esc_html(trim($p));
        $escaped = str_replace("\n", '<br />', $escaped);
        return '<p>' . $escaped . '</p>';
    }, array_filter($paragraphs, function ($p) {
        return trim($p) !== '';
    }));
    return implode("\n", $html_paragraphs);
}

function hasshin_receiver_handle_article(WP_REST_Request $request) {
    $params = $request->get_json_params();

    $article_id = isset($params['hasshin_article_id']) ? sanitize_text_field($params['hasshin_article_id']) : '';
    $title = isset($params['title']) ? sanitize_text_field($params['title']) : '';
    $body_text = isset($params['body']) ? (string) $params['body'] : '';
    $source_note = isset($params['source_note']) ? sanitize_text_field($params['source_note']) : '';

    if ($article_id === '' || $title === '' || trim($body_text) === '') {
        return new WP_Error('hasshin_bad_request', 'title, body, hasshin_article_id は必須です。', ['status' => 400]);
    }

    $content = hasshin_receiver_body_to_html($body_text);
    if ($source_note !== '') {
        $content .= "\n<!-- hasshin source: " . esc_html($source_note) . " -->";
    }

    // 同じ記事IDが既に送信済みなら、新規作成ではなく上書き更新する（重複投稿防止）
    $existing = get_posts([
        'post_type' => 'post',
        'post_status' => ['draft', 'pending', 'publish', 'future', 'private'],
        'meta_key' => HASSHIN_RECEIVER_META_ARTICLE_ID,
        'meta_value' => $article_id,
        'numberposts' => 1,
        'fields' => 'ids',
    ]);

    $postarr = [
        'post_title' => $title,
        'post_content' => $content,
        'post_status' => 'draft',
        'post_type' => 'post',
    ];

    if (!empty($existing)) {
        $postarr['ID'] = $existing[0];
        $post_id = wp_update_post($postarr, true);
    } else {
        $post_id = wp_insert_post($postarr, true);
    }

    if (is_wp_error($post_id)) {
        return new WP_Error('hasshin_insert_failed', '下書きの作成に失敗しました: ' . $post_id->get_error_message(), ['status' => 500]);
    }

    update_post_meta($post_id, HASSHIN_RECEIVER_META_ARTICLE_ID, $article_id);
    update_option(HASSHIN_RECEIVER_OPTION_LOG, current_time('Y-m-d H:i:s') . '（記事「' . $title . '」）');

    return new WP_REST_Response([
        'post_id' => $post_id,
        'edit_url' => admin_url('post.php?post=' . $post_id . '&action=edit'),
        'status' => 'draft',
    ], $existing ? 200 : 201);
}

// ハッシン側で記事が完全削除されたとき（重大な個人情報の混入等）に、
// こちらの下書きも完全に消すためのエンドポイント。ゴミ箱に入れるのではなく
// 完全削除（force delete）にする。該当する下書きが無い場合も成功として扱う
// （ハッシン側の削除処理を止めないため）。
function hasshin_receiver_handle_delete_article(WP_REST_Request $request) {
    $article_id = sanitize_text_field($request->get_param('article_id'));

    $existing = get_posts([
        'post_type' => 'post',
        'post_status' => ['draft', 'pending', 'publish', 'future', 'private', 'trash'],
        'meta_key' => HASSHIN_RECEIVER_META_ARTICLE_ID,
        'meta_value' => $article_id,
        'numberposts' => 1,
        'fields' => 'ids',
    ]);

    if (empty($existing)) {
        return new WP_REST_Response(['deleted' => false, 'reason' => 'not_found'], 200);
    }

    $result = wp_delete_post($existing[0], true);

    if (!$result) {
        return new WP_Error('hasshin_delete_failed', '下書きの削除に失敗しました。', ['status' => 500]);
    }

    return new WP_REST_Response(['deleted' => true, 'post_id' => $existing[0]], 200);
}
