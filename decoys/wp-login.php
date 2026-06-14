<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Log In &rsaquo; WorldCup Admin</title>
  <style>
    body { font-family: -apple-system, "Segoe UI", Helvetica, sans-serif; background: #f0f0f1; color: #3c434a; padding: 80px 20px; margin: 0; }
    .login { width: 320px; margin: 0 auto; }
    .crest { font-size: 36px; text-align: center; margin-bottom: 14px; }
    form { background: #fff; border: 1px solid #c3c4c7; box-shadow: 0 1px 3px rgba(0,0,0,0.04); padding: 26px 24px 24px; border-radius: 4px; }
    label { display: block; margin: 10px 0 4px; font-size: 14px; color: #1d2327; }
    input[type=text], input[type=password] { width: 100%; padding: 6px 8px; box-sizing: border-box; border: 1px solid #8c8f94; border-radius: 3px; font-size: 14px; }
    input:focus { outline: 2px solid #2271b1; outline-offset: -1px; }
    button { background: #2271b1; color: #fff; border: 0; padding: 8px 16px; border-radius: 3px; margin-top: 18px; width: 100%; font-size: 14px; cursor: pointer; }
    button:hover { background: #135e96; }
    .nav { text-align: center; margin-top: 18px; font-size: 13px; }
    .nav a { color: #2271b1; text-decoration: none; }
    .nav a:hover { text-decoration: underline; color: #135e96; }
    .error { background: #fbeaea; border-left: 4px solid #d63638; padding: 10px 12px; color: #1d2327; font-size: 13px; margin-bottom: 14px; box-shadow: 0 1px 1px rgba(0,0,0,0.04); }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="login">
    <div class="crest">⚽</div>
    <div id="error" class="error hidden" role="alert">
      <strong>Error:</strong> The password you entered is incorrect.
    </div>
    <form id="loginform" method="post" action="/wp-login.php">
      <label for="user_login">Username or Email Address</label>
      <input type="text" name="log" id="user_login" autocomplete="username" autocapitalize="off" autocorrect="off" />
      <label for="user_pass">Password</label>
      <input type="password" name="pwd" id="user_pass" autocomplete="current-password" />
      <input type="hidden" name="redirect_to" value="/wp-admin/" />
      <button type="submit">Log In</button>
    </form>
    <p class="nav"><a href="/wp-login.php?action=lostpassword">Lost your password?</a></p>
    <p class="nav"><a href="/">&larr; Back to site</a></p>
  </div>
  <script>
    (function() {
      var form = document.getElementById('loginform');
      var err = document.getElementById('error');
      var pwd = document.getElementById('user_pass');
      var attempts = 0;
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        attempts++;
        var delay = 800 + Math.random() * 1400;
        var btn = form.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Logging In…';
        setTimeout(function() {
          err.classList.remove('hidden');
          err.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          pwd.value = '';
          btn.disabled = false;
          btn.textContent = 'Log In';
          if (attempts >= 3) {
            err.innerHTML = '<strong>Error:</strong> You have exceeded the number of allowed login attempts. Please try again later.';
          }
        }, delay);
      });
    })();
  </script>
  <!--
    Friend, no amount of password guessing will get you anywhere.
    There is no PHP. There is no database. There is no auth.
    Just one static HTML page about whether the World Cup is happening.

    The next time the kit comes out of the bag, it'll be for a real game.
  -->
</body>
</html>
