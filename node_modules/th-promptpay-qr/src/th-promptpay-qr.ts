import QRCode from 'qrcode'
import crc from 'crc'
let applicationID = "A000000677010111";

export function getPromptpayCode(promptpayAccount: string, amount?: number) {
    // Type Length Value
    // First 2 byte: type
    // Second 2 byte: length of value
    // Third byte: value
    let promptpayCode = "00" + "02" + "01"; // Thailad Fixed code for type 00
    promptpayCode += "01" + "02" + "11"; // Type of code (11 Fro multiple payment, 12 for single payment)
    let promptpayAccountArray = Array.from(promptpayAccount);
    if (promptpayAccount.length < 13) {
        // Telephone number
        if (promptpayAccountArray[0] === '0') {
            promptpayAccountArray.splice(0, 1);
            promptpayAccountArray.splice(0, 0, '66');
            promptpayAccount = promptpayAccountArray.join('');
        }

        promptpayAccount = promptpayAccount.padStart(13, '0');
    }
    //Calculate sub type
    let promptpayCodeTmp = "00" + applicationID.length.toString(10).padStart(2, '0') + applicationID;
    promptpayCodeTmp += "01" + promptpayAccount.length.toString(10).padStart(2, '0') + promptpayAccount;
    // Add to promtpayCode
    promptpayCode += "29" + promptpayCodeTmp.length.toString(10).padStart(2, '0') + promptpayCodeTmp;
    promptpayCode += "58" + "02" + "TH"; // Country code
    if (amount && amount > 0) {
        //Add amount
        if (amount.toString(10).length > 99) {
            throw new Error('Invalid amount');
        }
        promptpayCode += "54" + amount.toFixed(2).length.toString(10).padStart(2, '0') + amount.toFixed(2);
    }
    //Add currency
    promptpayCode += "53" + "03" + "764";
    //Add crc type and length
    promptpayCode += "63" + "04";
    promptpayCode += crc.crc16xmodem(Buffer.from(promptpayCode, 'utf-8'), 0xFFFF).toString(16).padStart(4, '0').toUpperCase();
    return promptpayCode;
}

export function getQRCodeString(promptpayAccount: string, amount?: number, callback?: (error: Error | null | undefined, qr: string) => void) {
    let promtpayCode = getPromptpayCode(promptpayAccount, amount);
    if (callback) {
        return QRCode.toString(promtpayCode, {type:'terminal'}, callback);
    } else {
        return QRCode.toString(promtpayCode);
    }
}

export function getQRCodePNG(promptpayAccount: string, amount?: number, callback?: (error: Error | null | undefined, png: string) => void) {
    let promtpayCode = getPromptpayCode(promptpayAccount, amount);
    if (callback) {
        return QRCode.toDataURL(promtpayCode, callback);
    } else {
        return QRCode.toDataURL(promtpayCode);
    }
}