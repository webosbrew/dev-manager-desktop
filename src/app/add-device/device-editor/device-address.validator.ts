import {ValidatorFn} from '@angular/forms';

/** IPv4 literals or ASCII DNS hostnames; connection ports have their own field. */
export const deviceAddressValidator: ValidatorFn = control => {
    const address = control.value as string;
    if (!address) return null; // Validators.required handles an empty field.
    if (/\s/.test(address)) return {deviceAddress: true};

    // Numeric addresses must be complete IPv4 literals, not malformed octets or
    // abbreviated forms that some system resolvers interpret as an IP address.
    if (/^[0-9.]+$/.test(address)) {
        const octets = address.split('.');
        return octets.length === 4 && octets.every(octet => /^(0|[1-9][0-9]{0,2})$/.test(octet) && Number(octet) <= 255)
            ? null : {deviceAddress: true};
    }

    const hostname = address.endsWith('.') ? address.slice(0, -1) : address;
    const valid = hostname.length <= 253
        && hostname.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
    return valid ? null : {deviceAddress: true};
};
