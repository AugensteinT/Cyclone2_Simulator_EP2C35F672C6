from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import tempfile
import re
import uvicorn
import re
import os


app = FastAPI()

# Allow all origins (for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Or list your frontend URLs like ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],          # GET, POST, etc.
    allow_headers=["*"],
)

verilog_code = """
module Assignment1Question1(SW, LEDR);
    input [17:0] SW;
    output [17:0] LEDR;
    assign LEDR = SW;
endmodule
"""
inputs = {"SW": 0}  # SW = 18-bit value, here just 1


class SimulationRequest(BaseModel):
    code: str
    inputs: dict  # e.g., {"SW0": 1, "SW1": 0, ...}

@app.post("/simulate") 
async def simulate_verilog(request: SimulationRequest): 
    global verilog_code
    global inputs

    inputs = request.inputs
    verilog_code = request.code
    outputs, error_messages = simulate_verilog_with_inputs(verilog_code, inputs)
    
    if error_messages != "":

        cleaned_lines = [re.sub(r'^.*/', '', l) for l in error_messages.splitlines()]
        cleaned_text = "\n".join(cleaned_lines)

        return {"error_messages": cleaned_text}
    return {"outputs": outputs}

def simulate_verilog_with_inputs(verilog_code: str, inputs: dict):
    with tempfile.TemporaryDirectory() as tmpdir:
        verilog_file = os.path.join(tmpdir, "design.v")
        tb_file = os.path.join(tmpdir, "tb.v")
        output_exe = os.path.join(tmpdir, "sim.out")
        
        # Save the Verilog module
        with open(verilog_file, "w") as f:
            f.write(verilog_code)
        
        # Extract module name
        match = re.search(r"module\s+(\w+)\s*\(", verilog_code)
        if not match:
            raise ValueError("Cannot find module name")
        module_name = match.group(1)
        
        matches = re.findall(r'\((.*?)\)', verilog_code)
        
        identifiers = [x.strip() for x in matches[0].split(",")]
        
        # Build testbench
        tb_code = "module tb;\n"

        for identifier in identifiers:
            if identifier.startswith("SW"):
                tb_code += f"    reg [17:0]{identifier};\n"
            elif identifier.startswith("LEDR"):
                tb_code += f"    wire [17:0]{identifier};\n"
            elif identifier.startswith("LEDG"):
                tb_code += f"    wire [7:0]{identifier};\n"    
            else:
                tb_code += f"    wire [6:0]{identifier};\n"    

        # Build port connections dynamically
        port_connections = ", ".join([f".{name}({name})" for name in identifiers])

        # Add to testbench
        tb_code += f"    {module_name} uut({port_connections});\n"

        tb_code += "    initial begin\n"
        for signal, value in inputs.items():
            tb_code += f"        {signal} = {value};\n"
        tb_code += "        #1;\n"  # wait 1 time unit
        
        # Generate $display lines for all outputs (exclude inputs)
        for name in identifiers:
            if name not in "SW":
                tb_code += f'        $display("{name}=%b", {name});\n'


        tb_code += "        $finish;\n"
        tb_code += "    end\n"
        tb_code += "endmodule\n"
        
        # Save testbench
        with open(tb_file, "w") as f:
            f.write(tb_code)
        
        # Compile
        try:
            subprocess.run(["iverilog", "-o", output_exe, verilog_file, tb_file],
                           check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as e:
            print(f"Error running simulation: {e}")
            error_text = str(e.stderr)  # ensure it's a string
            print(f"Error running simulation: {error_text}")
            return [0, error_text]
        
        # Run simulation
        try:
            result = subprocess.run([output_exe], capture_output=True, text=True, check=True)
            output_lines = result.stdout.strip().splitlines()
            outputs = {}
            # Parse LEDR from printed line
            for line in output_lines:
                for name in identifiers:
                    if name not in "SW":  # only parse outputs
                        m = re.match(rf"{name}=(\d+)", line)
                        if m:
                            outputs[name] = int(m.group(1), 2)
            return [outputs, ""]
        except subprocess.CalledProcessError as e:
            error_text = str(e.stderr)  # ensure it's a string
            print(f"Error running simulation: {error_text}")
            return [0, error_text]
        
# Run server from Python
if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
