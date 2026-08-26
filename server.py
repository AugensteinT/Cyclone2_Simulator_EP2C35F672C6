from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import subprocess
import tempfile
import re
import uvicorn
import os


app = FastAPI()

# Allow all origins (for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


verilog_code = """
module Assignment1Question1(SW, LEDR);
    input [17:0] SW;
    output [17:0] LEDR;
    assign LEDR = SW;
endmodule
"""

inputs = {
    "SW": 0,
    "KEY": 0,
    "CLOCK": 0
}


class SimulationRequest(BaseModel):
    code: str
    inputs: dict
    board_inputs_array: list = []

@app.post("/simulate")
async def simulate_verilog(request: SimulationRequest):
    global verilog_code
    global inputs

    inputs = request.inputs
    verilog_code = request.code
    inputs_history = request.board_inputs_array

    outputs, error_messages = simulate_verilog_with_inputs(
        verilog_code,
        inputs,
        inputs_history
    )

    if error_messages != "":
        cleaned_lines = [
            re.sub(r'^.*/', '', line)
            for line in error_messages.splitlines()
        ]

        cleaned_text = "\n".join(cleaned_lines)

        return {
            "error_messages": cleaned_text
        }

    return {
        "outputs": outputs
    }


def simulate_verilog_with_inputs(verilog_code: str, inputs: dict, inputs_history: list):

    with tempfile.TemporaryDirectory() as tmpdir:

        verilog_file = os.path.join(tmpdir, "design.v")
        tb_file = os.path.join(tmpdir, "tb.v")
        output_exe = os.path.join(tmpdir, "sim.out")

        # --------------------------------------------------
        # Save Verilog module
        # --------------------------------------------------

        with open(verilog_file, "w") as f:
            f.write(verilog_code)

        # --------------------------------------------------
        # Extract module name and port list
        # --------------------------------------------------

        module_match = re.search(
            r'\bmodule\s+(\w+)\s*\((.*?)\)\s*;',
            verilog_code,
            flags=re.S
        )

        if not module_match:
            return [0, "Cannot find top-level module or port list."]

        module_name = module_match.group(1)

        port_text = module_match.group(2)

        identifiers = [
            port.strip()
            for port in port_text.split(",")
            if port.strip()
        ]

        # --------------------------------------------------
        # Find actual input/output declarations
        #
        # Supports declarations such as:
        #
        # input SW;
        # input [1:0] SW;
        # output LEDG;
        # output [17:0] LEDR;
        # --------------------------------------------------

        port_info = {}

        declaration_pattern = re.compile(
            r'\b(input|output)\s+'
            r'(?:\[(\d+)\s*:\s*(\d+)\]\s+)?'
            r'(\w+)\s*;',
            flags=re.S
        )

        for match in declaration_pattern.finditer(verilog_code):

            direction = match.group(1)

            msb = match.group(2)
            lsb = match.group(3)

            name = match.group(4)

            if msb is not None and lsb is not None:

                width = abs(int(msb) - int(lsb)) + 1

            else:

                width = 1

            port_info[name] = {
                "direction": direction,
                "width": width,
                "msb": msb,
                "lsb": lsb
            }

        # --------------------------------------------------
        # Verify ports
        # --------------------------------------------------

        missing_ports = [
            name
            for name in identifiers
            if name not in port_info
        ]

        if missing_ports:
            return [
                0,
                "Could not determine declarations for port(s): "
                + ", ".join(missing_ports)
            ]

        # --------------------------------------------------
        # Build testbench
        # --------------------------------------------------

        tb_code = "module tb;\n"

        inputs_set = set()
        outputs_set = set()

        for identifier in identifiers:

            info = port_info[identifier]

            direction = info["direction"]
            width = info["width"]

            # Input
            if direction == "input":

                inputs_set.add(identifier)

                if width == 1:
                    tb_code += f"    reg {identifier};\n"
                else:
                    tb_code += (
                        f"    reg [{width - 1}:0] "
                        f"{identifier};\n"
                    )

            # Output
            elif direction == "output":

                outputs_set.add(identifier)

                if width == 1:
                    tb_code += f"    wire {identifier};\n"
                else:
                    tb_code += (
                        f"    wire [{width - 1}:0] "
                        f"{identifier};\n"
                    )

        # --------------------------------------------------
        # Instantiate DUT
        # --------------------------------------------------

        port_connections = ", ".join(
            f".{name}({name})"
            for name in identifiers
        )

        tb_code += (
            f"    {module_name} uut"
            f"({port_connections});\n"
        )

        # --------------------------------------------------
        # Stimulus
        # --------------------------------------------------

        tb_code += "    initial begin\n"

        # --------------------------------------------------
        # Apply input history
        # --------------------------------------------------

        # Use the input history if it exists.
        # Each entry represents the board state at a
        # particular point in time.
        if inputs_history:

            for history_entry in inputs_history:

                # The frontend sends:
                #
                # {
                #     "inputs": {
                #         "SW": ...,
                #         "KEY": ...,
                #         "CLOCK": ...
                #     }
                # }
                #
                history_inputs = history_entry.get("inputs", {})

                for signal, value in history_inputs.items():

                    if signal not in inputs_set:
                        continue

                    tb_code += (
                        f"        {signal} = {value};\n"
                    )

                # Advance simulation by 1 ns before
                # applying the next input state.
                tb_code += "        #1;\n"

        else:

            # Fall back to the current inputs if no
            # history was supplied.
            for signal, value in inputs.items():

                if signal not in inputs_set:
                    continue

                if isinstance(value, list):

                    value = "".join(
                        str(int(bit))
                        for bit in reversed(value)
                    )

                    tb_code += (
                        f'        {signal} = '
                        f"{len(value)}'b{value};\n"
                    )

                else:

                    tb_code += (
                        f"        {signal} = {value};\n"
                    )

            tb_code += "        #1;\n"

        # --------------------------------------------------
        # Display outputs
        # --------------------------------------------------

        for name in outputs_set:

            tb_code += (
                f'        $display("{name}=%b", {name});\n'
            )

        tb_code += "        $finish;\n"
        tb_code += "    end\n"
        tb_code += "endmodule\n"

        # --------------------------------------------------
        # Save testbench
        # --------------------------------------------------

        with open(tb_file, "w") as f:
            f.write(tb_code)

        # Optional: print generated testbench
        print("\nGenerated testbench:")
        print(tb_code)

        # --------------------------------------------------
        # Compile
        # --------------------------------------------------

        try:

            subprocess.run(
                [
                    "iverilog",
                    "-o",
                    output_exe,
                    verilog_file,
                    tb_file
                ],
                check=True,
                capture_output=True,
                text=True
            )

        except subprocess.CalledProcessError as e:

            error_text = e.stderr or str(e)

            print("Icarus compile error:")
            print(error_text)

            return [0, error_text]

        # --------------------------------------------------
        # Run simulation
        # --------------------------------------------------

        try:

            result = subprocess.run(
                [output_exe],
                capture_output=True,
                text=True,
                check=True
            )

            output_lines = result.stdout.strip().splitlines()

            outputs = {}

            for line in output_lines:

                for name in outputs_set:

                    match = re.match(
                        rf"^{re.escape(name)}=([01xzXZ]+)$",
                        line
                    )

                    if match:

                        bin_str = match.group(1).lower()

                        # Convert unknown/high impedance states
                        # to zero for the frontend.
                        bin_str = (
                            bin_str
                            .replace("x", "0")
                            .replace("z", "0")
                        )

                        outputs[name] = int(bin_str, 2)

            return [outputs, ""]

        except subprocess.CalledProcessError as e:

            error_text = e.stderr or str(e)

            print("Simulation error:")
            print(error_text)

            return [0, error_text]


# --------------------------------------------------
# Run server
# --------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )