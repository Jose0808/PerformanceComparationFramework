
export interface IMobileSale {
    // mobileSelect: MobileSelect

    offerName: string
    customerData: CustomerData

}

export interface CustomerData {
    idType: string
    idNumber: string
    idExpiredDate: string
}