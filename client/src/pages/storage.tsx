import { useState, useEffect } from "react";
import { firebaseService } from "@/lib/firebaseStorage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HardDrive, Image, Database, AlertTriangle, Info, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StoragePage() {
  const [imageStorageUsed, setImageStorageUsed] = useState(0);
  const [dataStorageUsed, setDataStorageUsed] = useState(0);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [recordCounts, setRecordCounts] = useState({ leave: 0, employees: 0, holidays: 0, types: 0, users: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isExactSize, setIsExactSize] = useState(false);

  const IMAGE_CAPACITY_GB = 10;
  const FIRESTORE_CAPACITY_GB = 1;
  const DATA_CAPACITY_GB = FIRESTORE_CAPACITY_GB * 0.9;
  const EMERGENCY_RESERVE_GB = FIRESTORE_CAPACITY_GB * 0.1;

  useEffect(() => {
    calculateStorage();
  }, []);

  const calculateStorage = async () => {
    setIsLoading(true);
    setIsExactSize(false);
    try {
      const [leaveRequests, employees, holidays, leaveTypes, users] = await Promise.all([
        firebaseService.getLeaveRequests(),
        firebaseService.getEmployees(),
        firebaseService.getHolidays(),
        firebaseService.getLeaveTypes(),
        firebaseService.getUsers(),
      ]);

      setRecordCounts({
        leave: leaveRequests.length,
        employees: employees.length,
        holidays: holidays.length,
        types: leaveTypes.length,
        users: users.length,
      });

      // Get exact file sizes from Google Drive API
      try {
        const driveResponse = await fetch('/api/drive-storage', {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (driveResponse.ok) {
          const driveData = await driveResponse.json();
          setImageStorageUsed(driveData.totalBytes / (1024 * 1024 * 1024));
          setAttachmentCount(driveData.fileCount);
          setIsExactSize(true);
        } else {
          // Fallback to counting attachments
          let attachments = 0;
          leaveRequests.forEach(req => {
            if (req.attachmentUrl && req.attachmentUrl.length > 0) {
              attachments++;
            }
          });
          setAttachmentCount(attachments);
          const estimatedImageBytes = attachments * 0.5 * 1024 * 1024;
          setImageStorageUsed(estimatedImageBytes / (1024 * 1024 * 1024));
        }
      } catch (err) {
        // Fallback to counting attachments
        let attachments = 0;
        leaveRequests.forEach(req => {
          if (req.attachmentUrl && req.attachmentUrl.length > 0) {
            attachments++;
          }
        });
        setAttachmentCount(attachments);
        const estimatedImageBytes = attachments * 0.5 * 1024 * 1024;
        setImageStorageUsed(estimatedImageBytes / (1024 * 1024 * 1024));
      }

      const allData = { leaveRequests, employees, holidays, leaveTypes, users };
      const dataString = JSON.stringify(allData);
      const dataBytes = new Blob([dataString]).size;
      const estimatedFirestoreBytes = dataBytes * 1.5;
      setDataStorageUsed(estimatedFirestoreBytes / (1024 * 1024 * 1024));

    } catch (error) {
      console.error("Error calculating storage:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const imagePercentage = (imageStorageUsed / IMAGE_CAPACITY_GB) * 100;
  const dataPercentage = (dataStorageUsed / DATA_CAPACITY_GB) * 100;

  const formatBytes = (gb: number) => {
    if (gb < 0.001) {
      return `${(gb * 1024 * 1024).toFixed(2)} KB`;
    } else if (gb < 1) {
      return `${(gb * 1024).toFixed(2)} MB`;
    }
    return `${gb.toFixed(2)} GB`;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-heading">Storage</h1>
          <p className="text-muted-foreground mt-1">Monitor your storage usage across different services</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={calculateStorage}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Image className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Image Storage</CardTitle>
                <CardDescription>Google Drive folder storage</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium">{formatBytes(imageStorageUsed)} / {IMAGE_CAPACITY_GB} GB</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ease-out ${getProgressColor(imagePercentage)}`}
                  style={{ width: `${Math.min(imagePercentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{imagePercentage.toFixed(1)}% used</span>
                <span>{formatBytes(IMAGE_CAPACITY_GB - imageStorageUsed)} remaining</span>
              </div>
            </div>

            {imagePercentage >= 80 && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Storage is running low. Consider removing old attachments.</span>
              </div>
            )}

            {isExactSize ? (
              <div className="flex items-start gap-2 p-3 bg-green-50 text-green-800 rounded-lg text-xs">
                <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Exact size from Google Drive</p>
                  <p className="text-green-600">{attachmentCount} file{attachmentCount !== 1 ? 's' : ''} in folder</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-xs">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Estimated based on {attachmentCount} attachment{attachmentCount !== 1 ? 's' : ''}</p>
                  <p className="text-yellow-600">Could not fetch exact sizes from Drive</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Database className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Data Storage</CardTitle>
                <CardDescription>Firestore database (90% usable, 10% emergency reserve)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium">{formatBytes(dataStorageUsed)} / {(DATA_CAPACITY_GB * 1024).toFixed(0)} MB</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ease-out ${getProgressColor(dataPercentage)}`}
                  style={{ width: `${Math.min(dataPercentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{dataPercentage.toFixed(1)}% used</span>
                <span>{formatBytes(DATA_CAPACITY_GB - dataStorageUsed)} remaining</span>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <div className="flex items-center gap-2 mb-1">
                <HardDrive className="h-4 w-4" />
                <span className="font-medium">Emergency Reserve</span>
              </div>
              <p>{formatBytes(EMERGENCY_RESERVE_GB)} reserved for critical operations</p>
            </div>

            {dataPercentage >= 80 && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Storage is running low. Consider archiving old records.</span>
              </div>
            )}

            <div className="flex items-start gap-2 p-3 bg-purple-50 text-purple-800 rounded-lg text-xs">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Record counts</p>
                <p className="text-purple-600">
                  {recordCounts.leave} leave records, {recordCounts.employees} employees, {recordCounts.holidays} holidays, {recordCounts.types} leave types, {recordCounts.users} users
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Storage Overview</CardTitle>
          <CardDescription>Summary of all storage services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{formatBytes(imageStorageUsed)}</p>
                <p className="text-sm text-muted-foreground">Images Used</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600">{formatBytes(dataStorageUsed)}</p>
                <p className="text-sm text-muted-foreground">Data Used</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{formatBytes(IMAGE_CAPACITY_GB - imageStorageUsed + DATA_CAPACITY_GB - dataStorageUsed)}</p>
                <p className="text-sm text-muted-foreground">Total Available</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-orange-600">{formatBytes(EMERGENCY_RESERVE_GB)}</p>
                <p className="text-sm text-muted-foreground">Emergency Reserve</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <p className="text-sm text-muted-foreground">Calculating storage usage...</p>
          </div>
        </div>
      )}
    </div>
  );
}
