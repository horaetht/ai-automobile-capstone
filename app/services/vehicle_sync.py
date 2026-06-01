import random
from datetime import datetime

class SimulatedVehicleDataProvider:
    """
    Generates realistic simulated vehicle diagnostic data.
    This class is designed to be easily replaced with real API providers
    such as Smartcar API or OBD-II readers.
    """

    DTC_CODES = [None, None, "P0301", "P0420", "P0171", "P0455"]

    @staticmethod
    def generate_sync_data(current_mileage, current_fuel):
        """
        Generate updated vehicle telemetry data.

        Args:
            current_mileage: Current vehicle mileage in miles
            current_fuel: Current fuel level 0-100

        Returns:
            dict with updated vehicle metrics
        """
        # Mileage increases slightly (realistic for periodic syncs)
        mileage_increase = random.randint(5, 40)
        new_mileage = current_mileage + mileage_increase

        # Battery voltage fluctuates normally between 12.1-14.4V
        battery_voltage = round(random.uniform(12.1, 14.4), 2)

        # Fuel level decreases slightly or stays the same
        fuel_decrease = random.randint(0, 8)
        new_fuel = max(5, current_fuel - fuel_decrease)

        # Engine temperature (F) - normal range 170-220
        engine_temp = random.randint(170, 220)

        # DTC codes - mostly None, occasionally an error code
        dtc_code = random.choice(SimulatedVehicleDataProvider.DTC_CODES)

        return {
            "mileage": new_mileage,
            "battery_voltage": battery_voltage,
            "fuel_level": new_fuel,
            "engine_temperature": engine_temp,
            "dtc_code": dtc_code,
            "last_synced_at": datetime.now().isoformat()
        }
