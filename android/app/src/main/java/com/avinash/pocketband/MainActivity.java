package com.avinash.pocketband;

import android.media.AudioManager;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AlertDialog;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Pocket Band's Android shell. The web app runs unchanged inside Capacitor's WebView; this class only adds what a
 * native app needs: full screen, screen kept on, volume keys for media volume, sound without a first tap, and Back.
 */
public class MainActivity extends BridgeActivity {

    // Longest the splash stays up while the page loads
    private static final long SPLASH_MAX_MS = 2500;
    // Asks the page what Back should do: it returns 'handled' when it went Home (or closed a sheet), else 'exit'
    private static final String BACK_JS =
        "(function(){try{return window.__pbBack?window.__pbBack():'exit'}catch(e){return 'exit'}})()";

    private AlertDialog exitDialog;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        final long started = SystemClock.uptimeMillis();
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        splash.setKeepOnScreenCondition(() -> {
            WebView wv = bridge == null ? null : bridge.getWebView();
            boolean loaded = wv != null && wv.getProgress() >= 100;
            return !loaded && SystemClock.uptimeMillis() - started < SPLASH_MAX_MS;
        });

        // Volume buttons change media volume, even when nothing is playing
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        // Keep the screen on while the app is open
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Let the page start sound without a prior tap (Capacitor sets this too; set here so it never depends on that)
        bridge.getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);

        enterImmersive();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                onBack();
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        enterImmersive();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersive();
    }

    /** Hides the status and navigation bars; a swipe from the edge shows them briefly. */
    private void enterImmersive() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }

    /** Back inside an instrument returns Home (same as the Home button); Back on Home asks before exiting. */
    private void onBack() {
        if (bridge == null || bridge.getWebView() == null) {
            askExit();
            return;
        }
        bridge.getWebView().evaluateJavascript(BACK_JS, (result) -> {
            if (result != null && result.contains("handled")) return;
            askExit();
        });
    }

    private void askExit() {
        if (isFinishing() || (exitDialog != null && exitDialog.isShowing())) return;
        exitDialog = new AlertDialog.Builder(this)
            .setTitle("Exit Pocket Band?")
            .setPositiveButton("Exit", (d, w) -> finish())
            .setNegativeButton("Stay", null)
            .setOnDismissListener((d) -> enterImmersive())
            .show();
    }
}
