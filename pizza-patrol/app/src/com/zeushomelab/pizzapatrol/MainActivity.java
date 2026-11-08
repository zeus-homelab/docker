package com.zeushomelab.pizzapatrol;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Hosts the HTML5 game (assets/index.html) in a full-screen WebView. */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_FULLSCREEN);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0B0710);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        try { // API 17+: let WebAudio start without extra prompts
            WebSettings.class.getMethod("setMediaPlaybackRequiresUserGesture", boolean.class).invoke(s, false);
        } catch (Throwable ignored) { }

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("app://exit")) { finish(); return true; }
                return !url.startsWith("file:");
            }
        });
        setContentView(web);
        hideSystemBars();
        web.loadUrl("file:///android_asset/index.html");
    }

    private void hideSystemBars() {
        // IMMERSIVE_STICKY | LAYOUT_STABLE | LAYOUT_HIDE_NAVIGATION | LAYOUT_FULLSCREEN | HIDE_NAVIGATION | FULLSCREEN
        web.setSystemUiVisibility(0x1000 | 0x100 | 0x200 | 0x400 | 0x2 | 0x4);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    public void onBackPressed() {
        web.loadUrl("javascript:window.androidBack&&window.androidBack()");
    }

    @Override
    protected void onPause() {
        web.loadUrl("javascript:window.appPause&&window.appPause()");
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideSystemBars();
    }
}
