#!/usr/bin/env python3
import os
import json
import time
import requests
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)

# Required Environment Variables
API_BASE_URL = os.getenv("API_BASE_URL", "https://api.openai.com/v1")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")
HF_TOKEN = os.getenv("HF_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
# If using from_docker_image(), but we use direct REST
LOCAL_IMAGE_NAME = os.getenv("LOCAL_IMAGE_NAME")

# TRIAGE-X server URL
ENV_BASE_URL = os.getenv("TRIAGE_BASE_URL", "http://localhost:7860")
BENCHMARK = "triage-x"

TASKS = [
    "easy_signal_noise",
    "medium_hidden_dependency",
    "hard_multi_incident"
]

def get(url):
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    return r.json()

def post(url, data):
    r = requests.post(url, json=data, timeout=20)
    r.raise_for_status()
    return r.json()

def run_task(task_name, client, max_steps=20):
    # Log EXACTLY as required by the regex
    print(f"[START] task={task_name} env={BENCHMARK} model={MODEL_NAME}")
    
    try:
        reset_data = post(f"{ENV_BASE_URL}/reset", {"task_name": task_name})
        obs = reset_data["observation"]
    except Exception as e:
        print(f"[END] success=false steps=0 rewards=")
        return False, 0
    
    rewards = []
    success = False
    
    system_prompt = """
    You are an expert Site Reliability Engineer (SRE).
    Action space expects exactly one JSON object: {"action": "string", "target": "string"}.
    Available actions: noop, inspect_service, inspect_dependency, restart_service, throttle_queue, rollback_deploy, scale_service.
    Target must be the exact name of an active service.
    """
    
    steps_taken = 0
    for i in range(1, max_steps + 1):
        steps_taken = i
        user_prompt = f"Observation:\n{json.dumps(obs, indent=2)}\n\nWhat is your next action JSON?"
        
        error_msg = "null"
        try:
            response = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={ "type": "json_object" },
                temperature=0.2
            )
            raw_content = response.choices[0].message.content
            action_data = json.loads(raw_content)
            
            action_payload = {"action": action_data.get("action", "noop")}
            if "target" in action_data and action_data["target"]:
                action_payload["target"] = action_data["target"]
                
        except Exception as e:
            error_msg = str(e).replace('\n', ' ')
            action_payload = {"action": "noop"}
            
        action_str = json.dumps(action_payload, separators=(',', ':'))
        
        try:
            res = post(f"{ENV_BASE_URL}/step", action_payload)
            obs = res.get("observation", obs)
            done = res.get("done", False)
            success = res.get("success", False)
            reward_val = res.get("reward", 0.0)
            
            if "error" in res and res["error"]:
                 error_msg = str(res["error"])
        except Exception as e:
            reward_val = 0.0
            done = True
            error_msg = str(e).replace('\n', ' ')
            
        rewards.append(reward_val)
        
        # Log EXACTLY as formatting spec dictates
        done_str = "true" if done else "false"
        print(f"[STEP] step={i} action={action_str} reward={reward_val:.2f} done={done_str} error={error_msg}")
        
        if done:
            break
            
        time.sleep(0.5)
        
    success_str = "true" if success else "false"
    rewards_str = ",".join([f"{r:.2f}" for r in rewards])
    print(f"[END] success={success_str} steps={steps_taken} rewards={rewards_str}")
    return success

def main():
    api_key = HF_TOKEN if "huggingface" in API_BASE_URL else (OPENAI_API_KEY or "dummy_key")
    client = OpenAI(
        api_key=api_key,
        base_url=API_BASE_URL
    )
    
    try:
        get(f"{ENV_BASE_URL}/health")
    except Exception as e:
        print(f"Failed to connect to TRIAGE-X server at {ENV_BASE_URL}: {e}")
        return

    for task in TASKS:
        run_task(task, client, max_steps=20)
        
if __name__ == "__main__":
    main()
