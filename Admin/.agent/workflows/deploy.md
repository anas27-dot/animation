---
description: Steps to build and deploy the Admin Dashboard to the live server
---

# Deploy Admin Dashboard

Follow these steps to update the live admin dashboard:

// turbo
1. Build the production bundle locally:
   ```powershell
   cmd /c "npm run build"
   ```

2. Upload the files to a temporary directory on the server:
   ```powershell
   ssh -i "C:\Users\Troika\.ssh\troika-calling-dashboard.pem" ubuntu@13.204.53.119 "mkdir -p ~/tmp-deploy"
   scp -i "C:\Users\Troika\.ssh\troika-calling-dashboard.pem" -r dist/* ubuntu@13.204.53.119:~/tmp-deploy/
   ```

3. Move files to production and fix permissions:
   ```powershell
   ssh -i "C:\Users\Troika\.ssh\troika-calling-dashboard.pem" ubuntu@13.204.53.119 "sudo cp -r ~/tmp-deploy/* /var/www/omniagent-admin-dashboard/ && sudo chown -R www-data:www-data /var/www/omniagent-admin-dashboard && sudo chmod -R 755 /var/www/omniagent-admin-dashboard && rm -rf ~/tmp-deploy"
   ```
