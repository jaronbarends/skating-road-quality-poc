## Testing on iPhone during development

Safari on iOS refuses to even prompt for geolocation over plain HTTP, including local network IPs like 192.168.x.x. It silently denies it.
use ngrok instead:
`ngrok http 5500` (where `5500`) is your localhost's port number
