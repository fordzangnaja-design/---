package th.moneygamer.citysave;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Parcelable;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * ส่งรูปสลิปเข้าแอปแบบอัตโนมัติ 2 ทาง
 *  1) แชร์รูปจากแอปธนาคาร/แกลเลอรีมาที่ "เมืองออมเงิน" (ACTION_SEND / ACTION_SEND_MULTIPLE)
 *  2) สแกนรูปใหม่ในแกลเลอรี (เช่น สลิปที่ถูกบันทึก/สกรีนช็อต) ตั้งแต่ครั้งล่าสุด
 * รูปจะถูกคัดลอกไปไว้ในแคชของแอป แล้วส่งชื่อไฟล์ให้หน้าเว็บอ่านด้วย OCR
 */
@CapacitorPlugin(
    name = "SlipInbox",
    permissions = {
        @Permission(alias = "media", strings = {Manifest.permission.READ_MEDIA_IMAGES}),
        @Permission(alias = "legacyMedia", strings = {Manifest.permission.READ_EXTERNAL_STORAGE})
    }
)
public class SlipInboxPlugin extends Plugin {

    private static final List<String> pendingShared = new ArrayList<>();
    private static SlipInboxPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    private static String alias() {
        return Build.VERSION.SDK_INT >= 33 ? "media" : "legacyMedia";
    }

    /** เรียกจาก MainActivity เมื่อมี intent แชร์รูปเข้ามา */
    static void handleIntent(Context ctx, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        List<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) uris.add(u);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Parcelable> l = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (l != null) for (Parcelable p : l) if (p instanceof Uri) uris.add((Uri) p);
        } else {
            return;
        }
        // ใช้ intent นี้ครั้งเดียว กันซ้ำเมื่อหมุนจอ/กลับเข้าแอป
        intent.setAction(Intent.ACTION_MAIN);
        List<String> names = new ArrayList<>();
        for (Uri u : uris) {
            String n = copyToCache(ctx, u);
            if (n != null) names.add(n);
        }
        if (names.isEmpty()) return;
        synchronized (pendingShared) {
            pendingShared.addAll(names);
        }
        if (instance != null) {
            instance.notifyListeners("sharedSlips", new JSObject());
        }
    }

    private static String copyToCache(Context ctx, Uri uri) {
        try {
            File dir = new File(ctx.getCacheDir(), "slips");
            if (!dir.exists()) dir.mkdirs();
            File out = File.createTempFile("slip_", ".jpg", dir);
            try (InputStream in = ctx.getContentResolver().openInputStream(uri);
                 OutputStream os = new FileOutputStream(out)) {
                if (in == null) return null;
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
            }
            return out.getName();
        } catch (Exception e) {
            return null;
        }
    }

    /** คืนรายชื่อไฟล์ที่ถูกแชร์เข้ามาและยังไม่ได้ประมวลผล */
    @PluginMethod
    public void takeShared(PluginCall call) {
        JSArray arr = new JSArray();
        synchronized (pendingShared) {
            for (String s : pendingShared) arr.put(s);
            pendingShared.clear();
        }
        JSObject ret = new JSObject();
        ret.put("files", arr);
        call.resolve(ret);
    }

    @PluginMethod
    public void hasGalleryAccess(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState(alias()) == PermissionState.GRANTED);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestGalleryAccess(PluginCall call) {
        if (getPermissionState(alias()) == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias(alias(), call, "galleryPermCallback");
    }

    @PermissionCallback
    private void galleryPermCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState(alias()) == PermissionState.GRANTED);
        call.resolve(ret);
    }

    /** คัดลอกรูปใหม่ในแกลเลอรี (เพิ่มหลัง sinceSec วินาที) มาไว้ในแคช สูงสุด limit รูป */
    @PluginMethod
    public void scanGallery(PluginCall call) {
        if (getPermissionState(alias()) != PermissionState.GRANTED) {
            call.reject("no_permission");
            return;
        }
        final long since = call.getLong("sinceSec", 0L);
        final int limit = call.getInt("limit", 15);
        final Context ctx = getContext();
        new Thread(() -> {
            JSArray arr = new JSArray();
            long newest = since;
            ContentResolver cr = ctx.getContentResolver();
            String[] proj = {MediaStore.Images.Media._ID, MediaStore.Images.Media.DATE_ADDED};
            try (Cursor c = cr.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI, proj,
                MediaStore.Images.Media.DATE_ADDED + " > ?", new String[]{String.valueOf(since)},
                MediaStore.Images.Media.DATE_ADDED + " DESC")) {
                int count = 0;
                while (c != null && c.moveToNext() && count < limit) {
                    long id = c.getLong(0);
                    long added = c.getLong(1);
                    Uri u = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                    String name = copyToCache(ctx, u);
                    if (name != null) {
                        arr.put(name);
                        count++;
                        if (added > newest) newest = added;
                    }
                }
            } catch (Exception e) {
                call.reject("scan_failed: " + e.getMessage());
                return;
            }
            JSObject ret = new JSObject();
            ret.put("files", arr);
            ret.put("newest", newest);
            call.resolve(ret);
        }).start();
    }

    /** ลบรูปในแคชหลังอ่านเสร็จ */
    @PluginMethod
    public void cleanup(PluginCall call) {
        File dir = new File(getContext().getCacheDir(), "slips");
        File[] fs = dir.listFiles();
        if (fs != null) for (File f : fs) f.delete();
        call.resolve();
    }
}
