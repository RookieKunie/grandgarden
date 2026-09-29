# th-promptpay-qr

Thailand Promptpay QR code library.

## Installation

Use the node package manager [npm](https://www.npmjs.com/get-npm) to install TH-Promptpay-QR.

```bash
npm install th-promptpay-qr
```

## Usage

```node.js
// Node JS
var thPromptpayQr = require("th-promptpay-qr")

let promptpayCode = thPromptpayQr.getPromptpayCode('0812345678', 300);

// OR
// Return QR code as string drawing.

thPromptpayQr.getQRCodeString('0812345678', 300 (err, qr) => {
    console.log(qr);
})

//OR
// Retrurn png base64 encoding.

thPromptpayQr.getQRCodePNG('0812345678', 300, (err, png) => {
    console.log(png);
})

console.log(promptpayQRString);
```

```node.js
// Type Script
import {getPromptpayCode, getQRCodeString, getQRCodePNG} from 'th-promptpay-qr';

let promptpayCode = getPromptpayCode('0812345678', 300);

// OR
// Return QR code as string drawing.

getQRCodeString('0812345678', 300, (err, qr) => {
    console.log(qr);
})

//OR
// Retrurn png base64 encoding.

getQRCodePNG('0812345678', 300, (err, png) => {
    console.log(png);
})

```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License
[MIT](https://choosealicense.com/licenses/mit/)