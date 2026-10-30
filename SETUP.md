# Kapamilya Venue Vote: setup guide

Votes are saved in a Google Sheet. The website (hosted on Cloudflare) talks to a small Google Apps Script that you deploy from that sheet.

You have two files to use:

- `Code.gs` is the backend. It goes into Google Apps Script.
- `index.html` is the website. It goes to Cloudflare.

## Part 1: Google Sheet and Apps Script

1. Go to https://sheets.google.com and create a new blank spreadsheet. Name it **Kapamilya Venue Vote**.
2. In the sheet, click **Extensions > Apps Script**.
3. Delete everything in the editor, then paste the full contents of `Code.gs`.
4. Near the top, change `ADMIN_PIN` to your own PIN. This PIN protects the organizer view on the website, and it is stored only in the script, never in the web page.
5. Click **Save**. Pick `setup` in the function dropdown and click **Run**.
6. Google will ask for permission. Click **Review permissions**, choose your account, then **Advanced > Go to (project name) (unsafe) > Allow**. This warning is normal for your own scripts.
7. Go back to your sheet. A new tab called **Votes** now exists with the column headings.

## Part 2: Deploy as a web app

1. In Apps Script, click **Deploy > New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Description:** Venue vote
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.

You can test it by pasting the URL in your browser with `?action=results` at the end. You should see something like `{"ok":true,"counts":{"kuyas":0,"talabar":0,"9501":0},"total":0}`.

## Part 3: Connect the website

1. Open `index.html` in a text editor.
2. Find this line near the top of the script:

   ```js
   const API_URL = "PASTE_YOUR_WEB_APP_URL_HERE";
   ```

3. Replace the text in quotes with your Web app URL and save.

## Part 4: Put it on Cloudflare

1. Log in at https://dash.cloudflare.com.
2. Go to **Workers & Pages > Create > Pages > Upload assets**.
3. Name the project (for example `kapamilya-vote`), then upload a folder that contains your edited `index.html`. The file must be named exactly `index.html`.
4. Click **Deploy**. Cloudflare gives you a link like `https://kapamilya-vote.pages.dev`. Share that link with everyone.

## Using it

- **Voting:** People open your link, tap a venue, enter first name, last name and mobile number, then tap Cast my vote.
- **Duplicates:** A vote is rejected if the mobile number or the full name already voted. `0917 123 4567`, `+63 917 123 4567` and `09171234567` are treated as the same number.
- **Results:** Everyone sees the live totals on the page. Only totals are public, never names or numbers.
- **Seeing the voters:** Open the **Votes** tab in your Google Sheet, or use "Organizer access" on the website with your PIN.
- **Starting over:** Use "Reset all votes" in Organizer access, or delete the rows below the header in the sheet.

## If you change Code.gs later

Saving is not enough. Click **Deploy > Manage deployments**, then the pencil icon, set **Version** to **New version**, and click **Deploy**. The URL stays the same, so you don't need to touch the website.

## Troubleshooting

- **Page shows a "Preview mode" notice:** `API_URL` wasn't replaced, or it doesn't end in `/exec`.
- **"Couldn't load results":** The deployment's access must be **Anyone**. Redeploy if you picked a different setting.
- **Mobile numbers lose their leading 0:** Don't edit the Mobile column's format. It is set to plain text on purpose.
- **Don't rename the tab** `Votes` unless you also change `SHEET_NAME` in `Code.gs`.
- **Before the event, do a test vote**, then use Reset all votes to clear it.
