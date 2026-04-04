using Microsoft.EntityFrameworkCore;
using CandyPlayer.Data;
using CandyPlayer.Services;
using CandyPlayer.Extensions;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// 配置Serilog日志
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.File("logs/log-.txt",
        rollingInterval: RollingInterval.Day,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss} [{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// 添加服务到容器
builder.Services.AddControllersWithViews();

// 配置数据库连接
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(connectionString));

// 添加Session服务
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
});

// 配置Cookie认证
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = "CookieAuth";
    options.DefaultChallengeScheme = "CookieAuth";
    options.DefaultSignInScheme = "CookieAuth";
})
.AddCookie("CookieAuth", options =>
{
    options.LoginPath = "/Account/Login";
    options.LogoutPath = "/Account/Logout";
    options.AccessDeniedPath = "/Account/AccessDenied";
    options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
    options.SlidingExpiration = true;
    options.Cookie.Name = "CandyPlayer.Auth";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.MaxAge = TimeSpan.FromMinutes(30);
});

// 重要：增加文件上传大小限制
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartBodyLengthLimit = 1024 * 1024 * 1024; // 1GB
    options.MultipartBoundaryLengthLimit = int.MaxValue;
    options.MultipartHeadersLengthLimit = int.MaxValue;
});

// 增加请求体大小限制
builder.Services.Configure<IISServerOptions>(options =>
{
    options.MaxRequestBodySize = 1024 * 1024 * 1024; // 1GB
});

// 注册自定义服务
builder.Services.AddScoped<PasswordService>();
builder.Services.AddScoped<FileScannerService>();
builder.Services.AddScoped<UserInitializerService>();
builder.Services.AddScoped<MediaService>();

var app = builder.Build();

// 确保必要的目录存在
try
{
    var mediaPath = builder.Configuration["AppSettings:MediaPath"] ?? "D:\\CandyPlayer";
    var booksPath = builder.Configuration["AppSettings:BooksPath"] ?? "D:\\CandyPlayer\\Books";
    var musicPath = builder.Configuration["AppSettings:MusicPath"] ?? "D:\\CandyPlayer\\Music";
    var videosPath = builder.Configuration["AppSettings:VideosPath"] ?? "D:\\CandyPlayer\\Videos";

    if (!Directory.Exists(mediaPath)) Directory.CreateDirectory(mediaPath);
    if (!Directory.Exists(booksPath)) Directory.CreateDirectory(booksPath);
    if (!Directory.Exists(musicPath)) Directory.CreateDirectory(musicPath);
    if (!Directory.Exists(videosPath)) Directory.CreateDirectory(videosPath);

    // 确保数据库文件夹存在
    var dbPath = builder.Configuration.GetConnectionString("DefaultConnection")?
        .Replace("Data Source=", "");
    if (!string.IsNullOrEmpty(dbPath))
    {
        var dbDirectory = Path.GetDirectoryName(dbPath);
        if (!string.IsNullOrEmpty(dbDirectory) && !Directory.Exists(dbDirectory))
        {
            Directory.CreateDirectory(dbDirectory);
        }
    }

    Log.Information("目录初始化完成");
}
catch (Exception ex)
{
    Log.Error(ex, "目录初始化失败");
}

// 初始化数据库和用户数据
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        var userInitializer = services.GetRequiredService<UserInitializerService>();
        var fileScanner = services.GetRequiredService<FileScannerService>();

        // 确保数据库已创建
        context.Database.EnsureCreated();
        Log.Information("数据库初始化完成");

        // 初始化用户
        await userInitializer.InitializeUsersAsync();
        Log.Information("用户初始化完成");

        // 首次扫描文件
        await fileScanner.ScanAllFilesAsync();
        Log.Information("文件扫描完成");
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "初始化过程中发生错误");
        Log.Error(ex, "初始化过程中发生错误");
    }
}

// 配置HTTP请求管道
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}
else
{
    app.UseDeveloperExceptionPage();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseSession();

// 配置路由
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Account}/{action=Login}/{id?}");

// 启动应用程序
try
{
    Log.Information("CandyPlayer 应用程序启动");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "应用程序启动失败");
    throw;
}
finally
{
    Log.CloseAndFlush();
}