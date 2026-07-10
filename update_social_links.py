import os
import re

new_content = """          <div class="social-links">
            <a href="https://www.facebook.com/profile.php?id=61585086569466" target="_blank"><i class="fab fa-facebook-f"></i></a>
          </div>"""

# Pattern to match the entire social-links block
pattern = re.compile(r'\s+<div class="social-links">.*?</div>', re.DOTALL)

files_to_update = [
    'about.html', 'admin.html', 'blog.html', 'cart.html', 'checkout.html',
    'help.html', 'login.html', 'privacy.html', 'product.html', 'profile.html',
    'receipt.html', 'register.html', 'terms.html'
]

for filename in files_to_update:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        updated = pattern.sub(new_content, content)
        if updated != content:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(updated)
            print(f"Updated {filename}")
        else:
            print(f"No changes needed for {filename}")
    else:
        print(f"File {filename} not found")
