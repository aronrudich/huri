# Fix the submission map and add “I’m already here”

## Submission map

- Fix only the desktop version of the map opened from a submission card: SV 1 will be at the bottom-left, numbers will run bottom-to-top in each three-spot column, and SV 147 will be at the top-right. The working mobile layout stays unchanged.
- Keep the Map button available for SV locations, but highlight a spot blue only when the submission is a pickup where the valet is trying to find the car.
- Park requests will show the map without turning the newly parked location blue. Occupied and staged colors remain unchanged.
- Make the map heading match the request: pickup maps can identify the blue pickup location; park maps will not claim that a blue location is being picked up.

## ETA page

- Add a smaller gray **I’m already here** button directly under **Confirm Arrival Time** / **Update Arrival Time**, using the same muted appearance as the unselected Tomorrow and Pick a date controls.
- Pressing it will immediately mark that vehicle’s existing ETA request as arrived, move a future ETA to the current time, and alert the valet team that the customer is already there.
- Show a clear success state confirming that the team has been notified, while preventing duplicate taps during submission.
- Add the matching **Ya estoy aquí** action to the Spanish arrival page so both customer links behave the same way.
- Validate the dealership link and RO on the server, update only the matching company’s open ETA request, and return a safe error if the link cannot identify an active vehicle request.

## Verification

- Confirm the card-opened map has the correct desktop orientation while mobile remains unchanged.
- Confirm pickup locations are blue and park-request locations are not blue.
- Confirm “I’m already here” marks the ETA card as **Customer is here · ETA**, sends the existing arrival alert, and handles repeat or invalid submissions safely.
- Run the focused tests and check the preview build for errors.
