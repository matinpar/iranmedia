.class public Lir/matinpar/sarkar/MyChrome;
.super Landroid/webkit/WebChromeClient;
.source "MyChrome.java"


# instance fields
.field private mAct:Lir/matinpar/sarkar/MainActivity;


# direct methods
.method public constructor <init>(Lir/matinpar/sarkar/MainActivity;)V
    .locals 0

    invoke-direct {p0}, Landroid/webkit/WebChromeClient;-><init>()V

    iput-object p1, p0, Lir/matinpar/sarkar/MyChrome;->mAct:Lir/matinpar/sarkar/MainActivity;

    return-void
.end method


# virtual methods
.method public onShowFileChooser(Landroid/webkit/WebView;Landroid/webkit/ValueCallback;Landroid/webkit/WebChromeClient$FileChooserParams;)Z
    .locals 3

    new-instance v0, Landroid/content/Intent;

    const-string v1, "android.intent.action.GET_CONTENT"

    invoke-direct {v0, v1}, Landroid/content/Intent;-><init>(Ljava/lang/String;)V

    const-string v1, "*/*"

    invoke-virtual {v0, v1}, Landroid/content/Intent;->setType(Ljava/lang/String;)Landroid/content/Intent;

    const-string v1, "android.intent.category.OPENABLE"

    invoke-virtual {v0, v1}, Landroid/content/Intent;->addCategory(Ljava/lang/String;)Landroid/content/Intent;

    const-string v1, "انتخاب فایل پشتیبان"

    invoke-static {v0, v1}, Landroid/content/Intent;->createChooser(Landroid/content/Intent;Ljava/lang/CharSequence;)Landroid/content/Intent;

    move-result-object v0

    iget-object v1, p0, Lir/matinpar/sarkar/MyChrome;->mAct:Lir/matinpar/sarkar/MainActivity;

    const/16 v2, 0x64

    invoke-virtual {v1, v0, v2}, Landroid/app/Activity;->startActivityForResult(Landroid/content/Intent;I)V

    invoke-virtual {v1, p2}, Lir/matinpar/sarkar/MainActivity;->setFileCallback(Landroid/webkit/ValueCallback;)V

    const/4 v0, 0x1

    return v0
.end method
