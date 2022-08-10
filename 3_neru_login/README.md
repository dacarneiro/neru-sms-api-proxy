# neru-sms-api-proxy

Neru server with 2 endpoints (DLR and Inbound) to store client_ref from DLR to database, then a look the client_ref on Inbound. Also has UI to enter SMS endpoint on Inbound.

NERU SMS API Endpoints:
DLR:
https://api-us.vonage.com/v1/neru/i/neru-4f2ff535-neru-sms-api-proxy-sms-api/webhooks/delivery-receipt
INBOUND:
https://api-us.vonage.com/v1/neru/i/neru-4f2ff535-neru-sms-api-proxy-sms-api/webhooks/inbound
