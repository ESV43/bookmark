# Fable & Folio storefront

Static storefront backed by a Google Sheets catalog and Apps Script order endpoint. Product listings and both bookmark images come from your sheet; there are no built in product examples.

## 1. Create the product sheet

Create a Google Sheet with a tab named `Products`. Put these exact column names in the first row:

`id | name | description | price | category | frontImage | backImage | active | sortOrder`

Add one bookmark per row:

| Column | What to enter |
| --- | --- |
| `id` | Unique, stable SKU, such as `fern-001`. Keep it unchanged after orders arrive. |
| `name` | Product title shown on the listing and in the bag. |
| `description` | Short line under the title, such as a design or material note. |
| `price` | Number in INR, without a `₹` or commas, such as `149`. |
| `category` | Any category name. The storefront builds its filters from these values. |
| `frontImage` | Share link for the front artwork in Drive. |
| `backImage` | Share link for the back artwork in Drive. |
| `active` | `TRUE` to list it; `FALSE` to hide it. |
| `sortOrder` | Optional number; lower values appear first. |

Example format (replace the placeholders with your own values):

`fern-001 | Your bookmark title | Short description | 149 | Botanical | https://drive.google.com/file/d/FRONT_FILE_ID/view | https://drive.google.com/file/d/BACK_FILE_ID/view | TRUE | 1`

### Prepare and link the images

1. Save the front and back as separate image files. For a 5 × 15 cm bookmark, use a portrait image close to a 1:3 width-to-height ratio (for example, 900 × 2700 pixels). The viewer shows the full image, so a matching ratio avoids distortion.
2. Upload both files to Google Drive.
3. For each file, choose **Share → General access → Anyone with the link → Viewer**. Copy the file’s share link into `frontImage` or `backImage`. Do not paste a folder link.
4. Open each link in a private/incognito browser window. It should show the image without asking you to sign in. If your Google Workspace blocks public links, use an image host that provides public direct image URLs.

Rows without an id, name, positive numeric price, or either image link are skipped. Set `active` to `FALSE` to temporarily hide a product; its row and any order history remain in the sheet. Refresh the storefront after editing the catalog.

## 2. Connect Apps Script

1. In the spreadsheet, choose **Extensions → Apps Script** and replace the editor contents with `apps-script/Code.gs`.
2. In `Code.gs`, replace `PASTE_GOOGLE_SHEET_ID_HERE` with the ID between `/d/` and `/edit` in the spreadsheet URL.
3. Choose **Deploy → Manage deployments → Edit**, select **New version**, and deploy. Set **Execute as** to your account and **Who has access** to **Anyone**. Approve both Sheets and Drive access when Google asks. The Drive permission lets the script serve the catalog images to the store, even when Drive's normal share page will not display inside an image tag.
4. Keep using your deployed URL ending in `/exec`. In `app.js`, `CONFIG.appsScriptUrl` should contain that URL. Set `CONFIG.upiId` and `CONFIG.payeeName` to your payment details.
5. Host `index.html`, `styles.css`, and `app.js` on a static host. Apps Script serves active products and creates an `Orders` tab when the first order arrives.

Keep the spreadsheet private. The public Apps Script endpoint returns active product fields. The `Orders` tab contains customer names, email addresses, and delivery addresses; limit sheet access to people handling orders.

## 3. UPI orders

Checkout sends the order to Sheets as `PENDING UPI`, then opens a `upi://pay` request with the total and order ID. There is no payment gateway or automatic verification. Check the payment in your UPI app or bank, match the buyer’s UTR/reference to the order, then update Payment Status before confirming fulfillment.

The Apps Script image endpoint only serves image files linked from active product rows, and rejects files over 8 MB. Without an Apps Script URL, the catalog stays empty and orders are not submitted to Sheets.
