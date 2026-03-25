using CandyRepository.Data;
using CandyRepository.Services;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

// 配置数据库
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(connectionString));

// 配置Session
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
});

// 注册服务
builder.Services.AddScoped<IFileService, FileService>();
builder.Services.AddScoped<IPermissionService, PermissionService>();
builder.Services.AddScoped<ILogService, LogService>();

// 注册HttpContextAccessor
builder.Services.AddHttpContextAccessor();

// 配置上传限制
builder.Services.Configure<FormOptions>(options =>
{
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartBodyLengthLimit = builder.Configuration.GetValue<long>("Storage:MaxFileSize", 104857600);
    options.MemoryBufferThreshold = int.MaxValue;
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseSession();

app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

// 初始化数据库和默认用户
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        context.Database.EnsureCreated();

        // 初始化默认用户
        await InitializeDefaultUsers(context);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while initializing the database.");
    }
}

async Task InitializeDefaultUsers(ApplicationDbContext context)
{
    // 管理员
    if (!await context.Users.AnyAsync(u => u.Username == "zoe"))
    {
        var (adminHash, adminSalt) = HashPassword("candy");
        var admin = new CandyRepository.Models.User
        {
            Username = "zoe",
            PasswordHash = adminHash,
            Salt = adminSalt,
            IsAdmin = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        context.Users.Add(admin);
    }

    // 普通用户 user1-user10
    for (int i = 1; i <= 10; i++)
    {
        var username = $"user{i}";
        if (!await context.Users.AnyAsync(u => u.Username == username))
        {
            var (userHash, userSalt) = HashPassword("123456");
            var user = new CandyRepository.Models.User
            {
                Username = username,
                PasswordHash = userHash,
                Salt = userSalt,
                IsAdmin = false,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            context.Users.Add(user);
        }
    }

    await context.SaveChangesAsync();
}

(string hash, string salt) HashPassword(string password)
{
    var salt = Guid.NewGuid().ToString();
    using (var sha256 = System.Security.Cryptography.SHA256.Create())
    {
        var saltedPassword = password + salt;
        var bytes = System.Text.Encoding.UTF8.GetBytes(saltedPassword);
        var hash = sha256.ComputeHash(bytes);
        return (Convert.ToBase64String(hash), salt);
    }
}

app.Run();