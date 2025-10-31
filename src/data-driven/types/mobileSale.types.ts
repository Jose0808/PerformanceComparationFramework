
export interface IMobileSale {
    // mobileSelect: MobileSelect

    offerName: string
    customerData: CustomerData
    deviceType: string,
    IMEI: string,
    resource: Resource
}

export interface CustomerData {
    idType: string
    idNumber: string
    idExpiredDate: string
}

export interface Resource {
    simCard: string,
    lotDeviceType: string,
    lotSimCardType: string,
}