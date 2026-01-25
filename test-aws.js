// Quick test to check AWS credentials and EC2 instances
import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';

const testAWSConnection = async () => {
  try {
    console.log('🔍 Testing AWS connection...');
    
    const ec2Client = new EC2Client({ region: 'us-east-1' });
    const command = new DescribeInstancesCommand({
      MaxResults: 50
    });
    
    const response = await ec2Client.send(command);
    
    const instances = [];
    response.Reservations?.forEach(reservation => {
      reservation.Instances?.forEach(instance => {
        const nameTag = instance.Tags?.find(tag => tag.Key === 'Name');
        instances.push({
          instanceId: instance.InstanceId,
          name: nameTag?.Value || 'Unnamed',
          state: instance.State?.Name,
          type: instance.InstanceType
        });
      });
    });
    
    console.log('✅ AWS connection successful!');
    console.log(`📊 Found ${instances.length} instances:`);
    
    instances.forEach(instance => {
      console.log(`  • ${instance.name} (${instance.instanceId}) - ${instance.state} - ${instance.type}`);
    });
    
    return instances;
  } catch (error) {
    console.error('❌ AWS connection failed:', error.message);
    if (error.name === 'CredentialsProviderError') {
      console.log('💡 Make sure to run: aws configure');
    }
    return [];
  }
};

testAWSConnection();