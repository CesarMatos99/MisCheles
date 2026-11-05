package com.mischeles.app

import android.content.Intent
import android.net.Uri
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.mischeles.app/mail_oauth")
            .setMethodCallHandler { call, result ->
                if (call.method != "openAuthorization") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                val rawUrl = call.arguments as? String
                val parsed = rawUrl?.let { runCatching { Uri.parse(it) }.getOrNull() }
                val host = parsed?.host
                val allowed = parsed?.scheme == "https" &&
                    (host == "accounts.google.com" || host == "login.microsoftonline.com")
                if (!allowed || parsed == null) {
                    result.error("invalid-url", "Authorization URL is not allowed", null)
                    return@setMethodCallHandler
                }
                runCatching {
                    startActivity(Intent(Intent.ACTION_VIEW, parsed))
                    result.success(true)
                }.onFailure { result.error("browser-unavailable", "Could not open the authorization page", null) }
            }
    }
}
