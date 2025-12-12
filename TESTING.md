# Testing the Start Button

## Prerequisites
- Docker and Docker Compose installed
- Repository cloned locally

## Test Steps

1. **Build and start the setup UI**:
   ```bash
   docker compose -f compose.setup.yaml up -d --build
   ```

2. **Access the UI**:
   - Open `http://localhost:8080/` in your browser

3. **Fill in Step 1**:
   - APPDATA_ROOT: `/volume1/docker/appdata` (or your preferred path)
   - DATA_ROOT: `/volume1/data`
   - TRANSCODE_ROOT: `/volume1/docker/transcode`
   - PUID: `1026` (or your user ID)
   - PGID: `100` (or your group ID)
   - TZ: Select your timezone
   - Click **Next**

4. **Step 2 - Test the Start button**:
   - Review your settings
   - Optionally add a PLEX_CLAIM token
   - Click **Start** (NOT Download .env)

5. **Expected Results**:
   - The UI should show "Stack started successfully!"
   - A `.env` file should be created in the repository root
   - The full stack should be running (Plex, Sonarr, Radarr)
   - Access URLs should be displayed for each service

6. **Verify stack is running**:
   ```bash
   docker compose ps
   ```
   You should see: `plex`, `sonarr`, `radarr`, and `setup-ui` containers running

7. **Verify .env file**:
   ```bash
   cat .env
   ```
   Should contain your configured values

8. **Test service access**:
   - Plex: `http://localhost:32400/web`
   - Sonarr: `http://localhost:8989`
   - Radarr: `http://localhost:7878`

## Cleanup
```bash
docker compose down
docker compose -f compose.setup.yaml down
rm .env
```

## Known Issues / Notes
- The setup UI container needs Docker socket access (`/var/run/docker.sock`)
- The repository must be mounted read-write (not `:ro`) for `.env` creation
- Services may take 30-60 seconds to fully start after clicking Start
