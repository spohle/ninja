# DOCKER UPDATE IMAGES
docker build -t render-api:latest -f Dockerfile.api .
docker build -t render-worker:latest -f Dockerfile.worker .

# KUBES
# apply new docker image to kube
kubectl rollout restart deployment render-api
kubectl rollout restart deployment render-worker

# get logs from a node
kubectl logs deployment/render-worker

# list all pods
kubectl get pods

# list files in a pod
kubectl exec deployment/render-worker -- ls -lh /render_data/

# starting pods from scratch
kc apply -f api.yml
kc apply -f storage.yml
kc apply -f redis.yml
kc apply -f worker.yml

# ssh into a pod
kubectl exec -it deployment/render-worker -- /bin/bash


