# Gmail MCP

A Model Context Protocol (MCP) server for Gmail operations using IMAP/SMTP with app password authentication.

## Features

### Email Management
- **listMessages**: List the last 10 messages (or more if specified)
- **listUnread**: List unread messages (default: last 10)
- **findMessage**: Search for messages containing specific words or phrases (supports folder search: `in:sent`, `in:trash`, etc.)
- **sendMessage**: Send emails with HTML formatting and multiple CC/BCC recipients
- **markAsRead**: Mark messages (by ID) as read
- **deleteMessage**: Delete messages (move to Trash)

### Label Management
- **listLabels**: List all available labels in your mailbox
- **createLabel**: Create a new label (supports sub-labels like `Parent/Child`)
- **renameLabel**: Rename an existing label
- **moveLabel**: Move a label to nest it under another parent label
- **deleteLabel**: Delete a label
- **moveMessage**: Move a message to a different label/folder
- **labelMessage**: Apply labels to a message

## Simple Setup (No OAuth Required!)

### 1. Gmail App Password Setup

1. **Enable 2-Factor Authentication** on your Gmail account
2. Go to **Google Account Settings** → **Security** → **App passwords**
3. Generate an **App password** for "Mail"
4. Copy the 16-character app password

### 2. Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file:
   ```env
   EMAIL_ADDRESS=your_email@gmail.com
   EMAIL_PASSWORD=your_16_char_app_password
   IMAP_HOST=imap.gmail.com
   IMAP_PORT=993
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   ```

3. Build and start:
   ```bash
   npm run build
   npm start
   ```

### 3. Docker Usage

1. Create your `.env` file (as above)

2. Build and run:
   ```bash
   npm run docker:build
   docker run --rm -i --env-file .env gmail-mcp
   ```

## MCP Client Integration

### Simple Docker Configuration

Add this to your MCP client settings:

```json
{
  "mcpServers": {
    "email": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--env-file", ".env",
        "gmail-mcp"
      ]
    }
  }
}
```

### Using with Docker Compose

```json
{
  "mcpServers": {
    "email": {
      "command": "docker-compose",
      "args": ["run", "--rm", "gmail-mcp"]
    }
  }
}
```

## Supported Email Providers

### Gmail (Default)
- IMAP: `imap.gmail.com:993` (SSL)
- SMTP: `smtp.gmail.com:587` (TLS)
- **Requires**: App password (not regular password)

### Outlook/Hotmail
Update `.env`:
```env
IMAP_HOST=outlook.office365.com
SMTP_HOST=smtp-mail.outlook.com
```

### Other Providers
Just update the IMAP/SMTP settings in your `.env` file!

## Usage Examples

### List Recent Messages
```json
{
  "count": 20
}
```

### Search Messages
```json
{
  "query": "important meeting"
}
```

### Send Email
```json
{
  "to": "recipient@example.com",
  "subject": "Hello from MCP!",
  "body": "This email was sent via the Email MCP Server"
}
```

## Why IMAP/SMTP vs Gmail API?

✅ **IMAP/SMTP Advantages:**
- Simple app password authentication
- Works with any email provider
- No OAuth2 complexity
- No Google Cloud Console setup
- Immediate setup (2 minutes)

❌ **Gmail API Disadvantages:**
- Complex OAuth2 flow
- Google Cloud Console configuration
- Token management and refresh
- Gmail-only (vendor lock-in)

## Usage with Claude Desktop

### Configuration
1. Add the MCP server configuration to your Claude Desktop config file:
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Add this configuration:
```json
{
  "mcpServers": {
    "gmail-mcp": {
      "command": "node",
      "args": ["C:\\path\\to\\your\\Gmail-MCP\\dist\\index.js"],
      "cwd": "C:\\path\\to\\your\\Gmail-MCP",
      "env": {
        "NODE_ENV": "production",
        "EMAIL_ADDRESS": "your-email@gmail.com",
        "EMAIL_PASSWORD": "your-app-password",
        "IMAP_HOST": "imap.gmail.com",
        "IMAP_PORT": "993",
        "SMTP_HOST": "smtp.gmail.com",
        "SMTP_PORT": "587"
      }
    }
  }
}
```

3. Update the paths and credentials with your actual values
4. Restart Claude Desktop
5. Test with commands like:
   - "List my recent emails"
   - "Search for emails from john@example.com"
   - "Send an email to test@example.com with subject 'Test' and message 'Hello!'"

### Docker Usage
```bash
npm run docker:build
npm run docker:up
# Check logs:
npm run docker:logs
```

## Troubleshooting

### Authentication Errors

- Ensure 2FA is enabled on Gmail
- Use App Password, not your regular password
- Check that IMAP is enabled in Gmail settings

### Connection Issues

- Verify IMAP/SMTP settings for your provider
- Check firewall/network restrictions
- Ensure ports 993 (IMAP) and 587 (SMTP) are open

### Docker Issues

- Make sure `.env` file exists and is properly formatted
- Build the image first: `npm run docker:build`
- Check Docker logs: `npm run docker:logs`

## Usage

The server provides the following tools:

### listMessages

Lists recent messages from your Gmail inbox.

- Parameters: `count` (optional, default: 10, max: 100) - Number of messages to retrieve

Example:

```json
{
  "count": 20
}
```

### listUnread

Lists unread messages from your Gmail inbox.

- Parameters: `count` (optional, default: 10, max: 100) - Number of unread messages to retrieve

Example:

```json
{
  "count": 15
}
```

### findMessage

Searches for messages containing specific words.

- Parameters: `query` (required) - Search query using Gmail search syntax

Example:

```json
{
  "query": "from:example@gmail.com subject:important"
}
```

### sendMessage

Sends an email message with support for HTML formatting and multiple recipients.

- Parameters: 
  - `to` (required) - Recipient email address
  - `subject` (required) - Email subject
  - `body` (required) - Plain text message body
  - `html` (optional) - HTML version of the email for rich formatting
  - `cc` (optional) - Single email or array of emails for CC
  - `bcc` (optional) - Single email or array of emails for BCC

**Basic Example:**

```json
{
  "to": "recipient@example.com",
  "subject": "Hello from MCP Server",
  "body": "This is a test message sent from the Email MCP Server!"
}
```

**HTML Email Example:**

```json
{
  "to": "recipient@example.com",
  "subject": "Welcome!",
  "body": "Welcome to our service. This is the plain text version.",
  "html": "<h1>Welcome!</h1><p>Welcome to our <strong>service</strong>.</p><p>This is the <em>HTML</em> version.</p>"
}
```

**Multiple Recipients Example:**

```json
{
  "to": "recipient@example.com",
  "subject": "Team Update",
  "body": "Important team update",
  "cc": ["manager@example.com", "colleague@example.com"],
  "bcc": ["archive@example.com"]
}
```

**Single CC/BCC Example:**

```json
{
  "to": "recipient@example.com",
  "subject": "Quick Note",
  "body": "Just a quick note",
  "cc": "manager@example.com"
}
```


### markAsRead

Marks one or more messages (by UID) as read.

- Parameters: `messageIds` (required array of message UIDs returned by other tools)

Example:

```json
{
  "messageIds": ["12345", "12346"]
}
```

### deleteMessage

Deletes one or more messages (by UID) by moving them to the Trash folder.

- Parameters: `messageIds` (required array of message UIDs returned by other tools)

Example:

```json
{
  "messageIds": ["12345", "12346"]
}
```



### listLabels

Lists all available labels in your Gmail mailbox.

- Parameters: None required

Example:

```json
{}
```



### createLabel

Creates a new label in your Gmail mailbox. Supports hierarchical labels using forward slashes (e.g., `Parent/Child`).

- Parameters: `labelName` (required) - Name of the label to create. Use `/` to create nested labels.

Example:

```json
{
  "labelName": "Important/Work"
}
```

### deleteLabel

Deletes an existing label from your Gmail mailbox.

- Parameters: `labelName` (required) - Name of the label to delete

Example:

```json
{
  "labelName": "OldLabel"
}
```

### renameLabel

Renames an existing label in your Gmail mailbox.

- Parameters: 
  - `oldLabelName` (required) - Current name of the label
  - `newLabelName` (required) - New name for the label

Example:

```json
{
  "oldLabelName": "testLabel",
  "newLabelName": "productionLabel"
}
```

### moveLabel

Moves a label to nest it under a parent label, creating a hierarchical structure.

- Parameters: 
  - `labelName` (required) - Name of the label to move
  - `newParentLabel` (required) - Name of the parent label to nest under

Example:

```json
{
  "labelName": "ProjectA",
  "newParentLabel": "Archive"
}
```

This would move `ProjectA` to become `Archive/ProjectA`.

### moveMessage

Moves a message from one folder/label to another.

- Parameters: 
  - `messageId` (required) - UID of the message to move
  - `folder` (required) - Destination folder/label name
  - `sourceFolder` (optional, default: "INBOX") - Source folder/label name

Example:

```json
{
  "messageId": "12345",
  "folder": "Archive/2024",
  "sourceFolder": "INBOX"
}
```

### labelMessage

Applies one or more labels to a message.

- Parameters: 
  - `messageId` (required) - UID of the message to label
  - `labels` (required array) - Array of label names to apply

Example:

```json
{
  "messageId": "12345",
  "labels": ["Important", "Work", "Follow-up"]
}
```


## Gmail Search Syntax

The `findMessage` tool supports Gmail's advanced search syntax:

### Basic Search
- `keyword` - Search for keyword in subject or body
- `from:sender@example.com` - Find emails from specific sender
- `to:recipient@example.com` - Find emails to specific recipient
- `subject:keyword` - Find emails with keyword in subject

### Folder Search (Gmail-style)
- `in:inbox test` - Search for "test" in INBOX
- `in:sent meeting` - Search for "meeting" in Sent Mail
- `in:trash important` - Search for "important" in Trash
- `in:spam` - List messages in Spam folder
- `in:drafts` - List messages in Drafts
- `in:starred` - List starred messages
- `in:all` - Search in All Mail

### Date Filters
- `is:unread` - Find unread emails
- `after:2023/01/01` - Find emails after specific date
- `before:2023/12/31` - Find emails before specific date

### Important Note About Search Indexing
**Gmail's search index may take a few seconds to a few minutes to update after sending or receiving emails.** If you search for a recently sent email and don't find it immediately, this is normal behavior. The email was sent successfully, but Gmail's IMAP search index hasn't been updated yet. Try searching again after waiting 30-60 seconds.

## Development

Run in development mode:

```bash
npm run dev
```

Watch for changes:

```bash
npm run watch
```
