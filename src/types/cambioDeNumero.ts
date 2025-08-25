import { string } from "zod";
import CambioDeNumero from '../data-driven/CambioDeNumero.json'

export interface ICambioDeNumero {
    filters: {
        serviceNo?: string;
        idNumber?: string;
        accountCode?: string;
        idType?: string;
        Historic?: boolean;
        imei?: string;
    }
    SuscriptionRow: {
        PhoneNumber?: string;
        SuscriptorNumber?: string;
    }
}
const datacambiodenumero = CambioDeNumero as ICambioDeNumero;
export { datacambiodenumero };