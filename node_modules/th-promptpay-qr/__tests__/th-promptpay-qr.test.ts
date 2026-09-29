import {getPromptpayCode} from '../src/th-promptpay-qr';

describe("Test create qr code", () => {
    test("Should return code string", () => {
        expect(getPromptpayCode('0812345678', 300)).toEqual('00020101021129370016A000000677010111011300668123456785802TH5406300.00530376463045868');
    });
});