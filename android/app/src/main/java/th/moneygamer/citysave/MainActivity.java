package th.moneygamer.citysave;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SlipInboxPlugin.class);
        super.onCreate(savedInstanceState);
        SlipInboxPlugin.handleIntent(this, getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        SlipInboxPlugin.handleIntent(this, intent);
    }
}
