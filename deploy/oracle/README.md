# Oracle Cloud Always Free — Aurora WhatsApp Bot

Deploy the **existing** Aurora Software Labs support bot on an Oracle Cloud Infrastructure (OCI) Ubuntu VM. The bot connects outbound to WhatsApp using the unofficial Baileys linked-device protocol. It does **not** need a public website or open HTTP port. Read the compliance note in the main [README](../../README.md).

## 1. Create an Always Free Oracle account (account owner)

1. Visit https://signup.oraclecloud.com/ and register **your own** account. Complete Oracle's email, phone and payment-card verification yourself. Never send an account password, card data or private key to a chatbot, GitHub issue or support conversation.
2. Choose the **home region carefully**. Always Free compute can be provisioned only in the home region. Registration does not guarantee A1 capacity.
3. Once registered, visit https://cloud.oracle.com/ and open **Compute → Instances → Create instance**.
4. Enter name **aurora-whatsapp-bot** and choose an Ubuntu **24.04 ARM64/aarch64** image (Ubuntu 22.04 ARM64 works as well).
5. Choose **VM.Standard.A1.Flex** (Ampere ARM64, Always Free eligible), **1 OCPU and 6 GB RAM**. A 50 GB boot volume is enough. Confirm the console labels the options **Always Free eligible** and the estimated cost is zero **before** creating the VM. Do not choose a paid shape or extra service.
6. Attach/create a VCN and **public subnet** that provides outbound internet connectivity. Assign a public IPv4 address for initial SSH administration.
7. Generate or upload an SSH public key; **save the private key only on your device**. Set ingress on **TCP 22 only**, ideally restricted to your own public IP. No inbound 80/443/3000 ports are required for this bot.
8. Click **Create** and wait until the instance state reads **Running**.

Oracle can reclaim idle Always Free instances; a VM can also be unavailable because of capacity. This is not a 24/7 uptime guarantee. Official docs: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm and https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm

## 2. Connect to Ubuntu

Open PowerShell on a computer with your saved **private SSH key** (modify the path and public IP):

~~~powershell
ssh -i "$HOME\Downloads\ssh-key-2026.key" ubuntu@YOUR_ORACLE_PUBLIC_IP
~~~

Keep the private key private and check that the OCI subnet's security rule allows your IP on port 22.

## 3. Download the private GitHub repository

Inside your OCI SSH session, run:

~~~bash
sudo apt-get update
sudo apt-get install -y git gh
gh auth login --hostname github.com --git-protocol https --web
gh repo clone aurorasoftware-labs/rentlog-whatsapp-bot
cd rentlog-whatsapp-bot
~~~

Complete the GitHub device/browser login with the **GitHub account authorized to access this private repository**. If a browser cannot open on the VM, copy the one-time GitHub device code and open the URL displayed by the CLI on your own computer/phone. Do not paste a GitHub personal-access token into the repository, .env or a chat.

## 4. Install the systemd service

From the cloned repository:

~~~bash
sudo bash deploy/oracle/setup.sh
sudo systemctl status aurora-whatsapp-bot --no-pager
~~~

The installer:
- Installs Node.js 22 (if needed) and production dependencies on Ubuntu.
- Creates a restricted **aurorabot** service user.
- Runs syntax checks and unit tests.
- Installs the bot in **/opt/aurora-whatsapp-bot**.
- Stores the WhatsApp session separately at **/var/lib/aurora-whatsapp-bot/auth**, on the VM's persistent boot disk.
- Stores private configuration in **/etc/aurora-whatsapp-bot/aurora.env** (permissions 0640, root:aurorabot).
- Starts and enables a hardened **systemd** service. It restarts after crashes and on VM reboot.

No external AI service is enabled by default. The installer does not open network ports.

## 5. Link the WhatsApp / WhatsApp Business account

For a headless VM, use a temporary **pairing code**, not a terminal QR.

~~~bash
sudo nano /etc/aurora-whatsapp-bot/aurora.env
~~~

Add the following setting with the **phone number of the WhatsApp account that should reply to customers**, including international country code, with **digits only**:

~~~text
PAIRING_PHONE_NUMBER=919876543210
~~~

Save, then:

~~~bash
sudo systemctl restart aurora-whatsapp-bot
sudo journalctl -u aurora-whatsapp-bot -n 80 -f
~~~

Look for the one-time pairing code in the logs. On that WhatsApp account's phone, open **Settings → Linked devices → Link a device → Link with phone number instead**, then enter the code. Menu wording may vary by app version. After logs say **Aurora Software Labs WhatsApp Bot connected**, remove or comment out the temporary PAIRING_PHONE_NUMBER line and restart to verify saved authentication still works.

**Pairing codes and authentication/session files are sensitive**: don't screenshot or share them. On a machine where other users have log access, restrict journal access or clear old pairing-code log entries according to your retention policy.

## 6. Test from a different account

Send a one-to-one text message from **another WhatsApp account**:
- hi → menu with Aurora's products
- 2, then backup → RentLog information
- 3, then wheat → CropGuard information
- 4, then event → Crew Hub information
- 6 → Aurora contact information

Then restart and verify it answers **without re-pairing**:

~~~bash
sudo systemctl restart aurora-whatsapp-bot
sudo journalctl -u aurora-whatsapp-bot -n 80 --no-pager
~~~

For current status and logs:

~~~bash
sudo systemctl status aurora-whatsapp-bot --no-pager
sudo journalctl -u aurora-whatsapp-bot --since "15 minutes ago" --no-pager
~~~

## 7. Updates and recovery

To deploy a future GitHub change, inside your repository clone:

~~~bash
cd ~/rentlog-whatsapp-bot
git pull --ff-only
sudo bash deploy/oracle/setup.sh
~~~

The installer **does not delete** /var/lib/aurora-whatsapp-bot/auth or overwrite an existing /etc/aurora-whatsapp-bot/aurora.env.

For backups, securely encrypt and store the authentication folder **outside** the VM, with permissions restricted to the owner. Treat these files as session credentials; losing the VM's boot volume may require re-pairing. Never push auth state, GitHub credentials or API keys to GitHub.

## 8. Cost and reliability guardrails

- **Always Free shapes only**, in the tenancy's **home region**.
- Recommended allocation: **A1 Flex ARM, 1 OCPU, 6 GB RAM, 50 GB boot disk**, within the documented Always Free allowances.
- Do not add paid load balancers, extra disks, paid backups or upgrade to a charged plan simply to resolve A1 capacity errors.
- Monitor OCI billing/usage; trial credits can mask an accidentally paid service.
- Oracle can reclaim idle Always Free instances. For a business-critical bot, use the official WhatsApp Cloud API and a suitable managed provider instead of assuming unofficial Baileys automation offers guaranteed delivery.

**Current status:** these files prepare and install the software **after you create the OCI VM**. They do not create an Oracle account, OCI VM or WhatsApp linked device on their own.
