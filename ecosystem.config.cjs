// PM2 process file. Secrets are NOT here: they are loaded from an env file outside the repo.
const envFile = process.env.KERB_ENV_FILE || "/root/.kerb/collector.env";

module.exports = {
  apps: [
    {
      name: "kerb-collector",
      cwd: __dirname + "/apps/collector",
      script: "src/main.ts",
      interpreter: "node",
      interpreter_args: `--env-file=${envFile} --import tsx`,
      autorestart: true,
      restart_delay: 5000,
      exp_backoff_restart_delay: 2000,
      max_restarts: 1000,
      min_uptime: 20000,
      kill_timeout: 8000,
      max_memory_restart: "600M",
      time: true,
      out_file: "/root/.kerb/logs/collector.out.log",
      error_file: "/root/.kerb/logs/collector.err.log",
    },
    {
      name: "kerb-attester",
      cwd: __dirname + "/apps/attester",
      script: "src/main.ts",
      interpreter: "node",
      interpreter_args: `--env-file=${process.env.KERB_ATTESTER_ENV_FILE || "/root/.kerb/attester.env"} --import tsx`,
      autorestart: true,
      restart_delay: 15000,
      exp_backoff_restart_delay: 5000,
      max_restarts: 200,
      min_uptime: 60000,
      kill_timeout: 20000,
      max_memory_restart: "700M",
      time: true,
      out_file: "/root/.kerb/logs/attester.out.log",
      error_file: "/root/.kerb/logs/attester.err.log",
    },
  ],
};
