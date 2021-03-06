# Aloe Document Edit
​
Allow a user to edit a Document docx file using a Text Editor and commits drafts to a server as the user saves it.
​
## Installation flow
​
* Windows **.exe** , Mac **.dmg**
* Install Monitor app (that automatically registers the application schema needed to open the file on a local machine)
* Go to aloe document edit angular component
* Click on "Allow"
* When pop up shows, select open with "aloe-document-edit"
* The Monitor app runs automatically
* If the url param is correct, it will start to download the document from the server, if an error occurs, then shows an error message.
* The user is able to edit the document
* When click on "Save" in the Text Editor application, a draft is pushed to the server.
* If the file closes, the monitor closes too.
​
### Build 
    npm install
    npm run start
​
### Release 
 - Mac `npm run dist-mac`
 - Windows: `npm run dist`
​
## Config
​
- Application Schema: `docuedit://&apiUrl=https://<API_URL>&file=<FILE_NAME>`
​
- Application Server test GET: `https://docu-edit-demo-api.herokuapp.com/api/file`
​
- Application Server test POST: `https://docu-edit-demo-api.herokuapp.com/api/file`

## "apiUrl" and "file" params usage
​
- For get the file, a url is generated with the following format: <API_URL> + "?file" + <FILE_NAME>

- For save/post the file, a POST request to <API_URL> is send with the file named "file"
​
## UI Messages
​
    const allStatus = [
	    "Waiting for file editing",
	    "Openning file",
	    "File ready to edit",
	    "An error occurred while getting the file",
	    "Saving changes",
	    "File draft saved",
	    "Invalid link"
    ];
    
## Test API
​
    GET/ - /api/file
​
#### Body
none.
Response:
200 - SUCCESS - File Download
404 - File not found
​
​
    POST/ - /api/file
​
​
#### Body
fieldName: File ; value: file.docx
Headers:
headerName: content-type; value: multipart/form-data
#### Response
​
    200 - SUCCESS - Body:
    {
	    “File Name”: string // refers to file name upload
	    “Size”:  98653 // refers to file sizE
    }
​
    400 - MSG: No file Upload