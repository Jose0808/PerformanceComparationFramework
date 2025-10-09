import { ClientPanel, Individual360View } from "./searchClient.types";

export interface IResourceSale {
    filters: Individual360View,
    SuscriptionRow: ClientPanel
    resourceSelect: ResourceSelect
}

export interface ResourceSelect {
    reasonForSale: string,
    lotType: string,
    resource: {
        offerCategory: string,
        offerName: string
        features: object
    }
}